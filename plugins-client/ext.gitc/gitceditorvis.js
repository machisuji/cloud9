/**
 * TODO
 * 
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

define(function(require, exports, module) {
var Range = require("ace/range").Range;

module.exports = (function() {
    
    function GitEditorVis(gitccommands) {
        this.gitcCommands = gitccommands;
        this.currentEditor = undefined;
        this.currentFile = undefined;
        this.all_changes = {};
        this.annotations = {};
    }

    GitEditorVis.prototype = {

        onTabSwitch : function(e){
            if (e.nextPage.$editor.path !== "ext/code/code") {
                //only code editors are of our concern
                return;
            }
            this.currentFile = this.getFilePath(e.nextPage.id);
            this.currentEditor = e.nextPage.$editor.amlEditor.$editor;

            this.setGutterUpdateFunction(this.currentFile, this.currentEditor);
            if (e.currentTarget.$activepage) {
                var closed_file   = this.getFilePath(e.currentTarget.$activepage.id);
                var closed_editor = e.currentTarget.$activepage.$editor.amlEditor.$editor;
                this.undecorate(closed_file, closed_editor);
            }

            if (e.nextPage.$doc.type !== "diff") {
                //show unstaged and staged changes, use git diff without context
                this.gitcCommands.send("git diff -U0 " + this.currentFile, this.addChanges.bind(this));
                this.gitcCommands.send("git diff --cached -U0 " + this.currentFile, this.addChanges.bind(this));
                //maintain gutter tooltips
                this.currentEditor.renderer.scrollBar.addEventListener("scroll", this.onScroll.bind(this));
            }
        },
        
        onScroll : function(e) {
            //if (this.annotations[this.currentFile]) 
            //    this.addMissingDecoration();

			var layer = document.getElementsByClassName('ace_layer ace_marker-layer')[1];
            for (var i = 0; i < layer.children.length; i++) {
				var marker = layer.children[i];
				marker.onmousemove = this.onMouseMove;
			}
        },

        getFilePath : function(filePath) {
            if (typeof filePath === "undefined")
                filePath = tabEditors.getPage().$model.data.getAttribute("path");
            if (filePath.indexOf("/workspace/") === 0)
                filePath = filePath.substr(11);

            return filePath;
        },

        addChanges : function(output, parser) {
            var changes = parser.parseDiff(output.data, output.stream);
            var filename = output.args[output.args.length-1];
            var kind = output.args.contains("--cached")? "staged" : "unstaged";

            //cache changes
            if (!this.all_changes[filename]) {
                this.all_changes[filename] = {};
            }
            this.all_changes[filename][kind] = changes;
            
            if (changes.length !== 0) {
                //create annotations for unstaged changes of the current file
                this.annotateChunks(changes[0].chunks, kind, filename);
            }
            
            this.decorate(filename);
        },

        markGutterLine : function(annotation) {
			if (annotation.type == "added") {
                //this.currentEditor.renderer.addGutterDecoration(annotation.row, "gitc-added");
				this.currentEditor.getSession().addMarker(new Range(annotation.row, 0, annotation.row, 1), "gitc-added", "background", true);
            } else if (annotation.type == "changed") {
                //this.currentEditor.renderer.addGutterDecoration(annotation.row, "gitc-changed");
				this.currentEditor.getSession().addMarker(new Range(annotation.row, 0, annotation.row, 1), "gitc-changed", "background", true);
            } else if (annotation.type == "deleted") {
    			this.currentEditor.getSession().addMarker(new Range(annotation.row, 0, annotation.row, 1), "gitc-removed", "background", true);
            };
        },
        
        createAnnotation : function(line, type, chunk, msg, status) {
          var annotation = {
            row: line,
            type: type,
            chunk: chunk,
            text: msg,
            status: status,
            tooltip: undefined
          };
          
          return annotation;
        },
        
        createDeletedAnnotation : function(line, chunk, msg, status, filename) {
            var annotation = this.annotations[filename][status][line];
            if (!annotation) {
                return this.createAnnotation(line, "deleted", chunk, msg, status);
            } else if (annotation.type == "added") {
                annotation.type = "changed";
				return annotation;
            } else if (annotation.type == "changed") {
                return this.createDeletedAnnotation(line+1, chunk, msg, status, filename)
            } else if (annotation.type == "deleted") {
                annotation.text += ("\n" + msg);
				return annotation;
            }
        },
        
        createTooltips : function() {
            if (!this.annotations[this.currentFile]) {
                return;
            }

            var file_annotations = this.annotations[this.currentFile]
            var lines = this.currentEditor.getSession().getLength();
            var lastAnnotation = null;
            for (var i = 1; i <= lines; i++) {
                var annotation = file_annotations[i.toString()];
                if (annotation) {
                    if (!lastAnnotation) {
                        lastAnnotation = annotation;
                    
                        //create tooltip for this annotation
                        var p = document.createElement('p');
                        p.innerText = annotation.text;
                        
                        annotation.tooltip = document.createElement('div');
                        annotation.tooltip.className = 'gitc-tooltip';
                        annotation.tooltip.appendChild(p);
                        annotation.tooltip.appendChild(this.createTooltipLinkBar(annotation));
                    } else {
                        if (annotation.type == lastAnnotation.type && annotation.status == lastAnnotation.status) {
                            annotation.tooltip = lastAnnotation.tooltip;
                            var p = document.createElement('p');
                            p.innerText = annotation.text;
                            lastAnnotation.tooltip.insertBefore(p, lastAnnotation.tooltip.lastChild);
                        } else {
                            var p = document.createElement('p');
                            p.innerText = annotation.text;
                            
                            annotation.tooltip = document.createElement('div');
                            annotation.tooltip.className = 'gitc-tooltip';
                            annotation.tooltip.appendChild(p);
                            annotation.tooltip.appendChild(this.createTooltipLinkBar(annotation));
                            
                            lastAnnotation = null;
                        }
                    }
                    
                } else {
                    lastAnnotation = null;
                }
            }
        },
        
        createTooltipLinkBar : function(annotation) {
            var commitLink = document.createElement('a');
            commitLink.innerText = annotation.status == "staged" ? "Commit" : "Stage";
            commitLink.setAttribute("onclick", function(e) {
                console.log('Commit all changes belonging to this chunk.');
            });
            
            var revertLink = document.createElement('a');
            revertLink.innerText = annotation.status == "staged" ? "Revert" : "Unstage";
            revertLink.setAttribute("onclick", function(e) {
                console.log('Revert all changes belonging to this chunk.');
            });
            
            var commitRevertP = document.createElement('p');
            commitRevertP.className = "gitc-commit-revert";
            commitRevertP.appendChild(commitLink);
            commitRevertP.appendChild(revertLink);
            
            return commitRevertP;
        },
        
        undecorate : function(closedFile, editor) {
            if (this.annotations[closedFile]) {
                var annotations = this.annotations[closedFile];
                for (var annotation in annotations) {
                    this.undecorateGutterLine(annotations[annotation], editor);
                }
            }
        },
        undecorateGutterLine : function(annotation, editor) {
            if (annotation.type == "deleted") {
                editor.renderer.removeGutterDecoration(annotation.row, "gitc-removed");
            } else if (annotation.type == "added") {
                editor.renderer.removeGutterDecoration(annotation.row, "gitc-added");
            } else if (annotation.type == "changed") {
                editor.renderer.removeGutterDecoration(annotation.row, "gitc-changed");
            }
        },

        decorate : function(filename) {
            if (filename !== this.currentFile) {
                return;
            }
            this.createTooltips();
            
            if (this.all_changes[this.currentFile].unstaged && this.all_changes[this.currentFile].staged) {
                //add gutter decoration for all annotations
                var stagedAnnotations = this.annotations[this.currentFile].staged;
                for (var i in stagedAnnotations) {
                    this.markGutterLine(stagedAnnotations[i]);
                }

				var unstagedAnnotations = this.annotations[this.currentFile].unstaged;
                for (var i in unstagedAnnotations) {
                    this.markGutterLine(unstagedAnnotations[i]);
                }
            }
        },

		onMouseMove : function(e) {
			console.log("mouse moved");
		},

        annotateChunks : function(chunks, status, filename) {
            if (!this.annotations[filename]) {
				this.annotations[filename] = {};
            }
            
            if (!this.annotations[filename][status]) {
                this.annotations[filename][status] = {};
                
                var deletedLines = [];

				//create 'added' annotations
                for (var i = 0; i < chunks.length; i++) {
            		var chunk = chunks[i];
    				for (var j = 0; j < chunk.lines.length; j++) {
    					var line = chunk.lines[j];
                        if (line.status == "added") {
                            var annotation = this.createAnnotation(line.number_new-1, line.status, chunk, line.content, status);
                            this.annotations[filename][status][annotation.row.toString()] = annotation;
                        } else if (line.status == "deleted"){
							var k = -1;
							while (++k < deletedLines.length && deletedLines[k].number_old < line.number_old);
							deletedLines.splice(k, 0, line);
						}
                    }
                }
				
				for (var i = 0; i < deletedLines.length; i++) {
					var line = deletedLines[i];
                    if (line.status == "deleted") {
                        var annotation = this.createDeletedAnnotation(line.number_new-1, chunk, line.content, status, filename);
                        this.annotations[filename][status][annotation.row.toString()] = annotation;
                    }
				}
            }
        },
        
        isChangeAnnotation : function(annotation, filename) {
            var key = annotation.row.toString();
            var other = this.annotations[filename][key];
            return other && 
                (annotation.type == "deleted" && other.type == "added" || 
                annotation.type == "added" && other.type == "deleted");
        },

        addMissingDecoration : function() {
            var gutterCells = document.getElementsByClassName('ace_gutter-cell');
            var firstLineIndex = this.currentEditor.renderer.getFirstVisibleRow();
            for (var i = 0; i < gutterCells.length; i++) {
				if (this.annotations[this.currentFile].staged) {
					var stagedAnnotation = this.annotations[this.currentFile].staged[(firstLineIndex+i).toString()];
					this.addMissingDeletedDecoration(stagedAnnotation, gutterCells[i]);
				}
                
				if (this.annotations[this.currentFile].unstaged) {
					var unstagedAnnotation = this.annotations[this.currentFile].unstaged[(firstLineIndex+i).toString()];
					this.addMissingDeletedDecoration(unstagedAnnotation, gutterCells[i]);
				}
            }
        },

		addMissingDeletedDecoration : function(annotation, cell) {
			if (!annotation)
				return;
			
			//add deleted line marker, if not at start of visible gutter area (otherwise, marker would not be visible anyway)
            if (annotation.type == "deleted" && cell.previousSibling != undefined) {
                var marker = document.createElement('div');
                marker.classList.add("ace_gutter-cell");
                marker.classList.add("gitc-removed");
                marker.setAttribute("style", "height: 2px");

                cell.setAttribute("style", "height: 15px");
                cell.previousSibling.setAttribute("style", "height: 15px");
                cell.parentNode.insertBefore(marker, cell);
                cell = marker;
            }

            //add tooltip
            if (annotation.tooltip) {
                cell.appendChild(annotation.tooltip);
            }
		},
        
        updateLineNumbers : function(lines) {
            var firstLineIndex = this.currentEditor.renderer.getFirstVisibleRow();
            var lastLineIndex  = this.currentEditor.renderer.getLastVisibleRow();
            var self = this;
            var fun = function() {
                self.currentEditor.renderer.$gutterLayer.update({lines: lines, override: true});
            };
            if (lines) {
                setTimeout(fun, 0);
            }
        },

        customUpdate: function(config) {
            if (config.lines && config.override === true) {
                this.lines = config.lines;
            } else if (this.lines) {
                this.$config = config;
                config.lines = this.lines;
            } else if (config.lastRow) {
                return this.$originalUpdate(config);
            } else {
                throw ("Invalid State: neither lines nor start or end rows given (config: " +
                    config + ")")
            }
            var editor = this.currentEditor || (
                this.currentEditor = require("ext/gitc/gitc").gitEditorVis.currentEditor);
            var dom = require("ace/lib/dom");
            var oop = require("ace/lib/oop");
            var EventEmitter = require("ace/lib/event_emitter").EventEmitter;

            var current_lines = config.lines.slice(editor.renderer.getFirstVisibleRow());

            var emptyAnno = {className: "", text: []};
            var html = [];
            var fold = this.session.getNextFoldLine(i);
            var foldStart = fold ? fold.start.row : Infinity;
            var foldWidgets = this.$showFoldWidgets && this.session.foldWidgets;

            for (var i = 0; i < current_lines.length; ++i) {
                if(i > foldStart) {
                    i = fold.end.row + 1;
                    fold = this.session.getNextFoldLine(i, fold);
                    foldStart = fold ?fold.start.row :Infinity;
                }

                var annotation = this.$annotations[i] || emptyAnno;
                var lineNumber = current_lines[i];

                html.push("<div class='ace_gutter-cell",
                    this.$decorations[i] || "",
                    this.$breakpoints[i] ? " ace_breakpoint " : " ",
                    annotation.className,
                    "' title='", annotation.text.join("\n"),
                    "' style='height:", config.lineHeight, "px;'>", lineNumber);

                if (foldWidgets) {
                    var c = foldWidgets[i];
                    // check if cached value is invalidated and we need to recompute
                    if (c == null)
                        c = foldWidgets[i] = this.session.getFoldWidget(i);
                    if (c)
                        html.push(
                            "<span class='ace_fold-widget ", c,
                            c == "start" && i == foldStart && i < fold.end.row ? " closed" : " open",
                            "'></span>"
                        );
                }

                var wrappedRowLength = this.session.getRowLength(i) - 1;
                while (wrappedRowLength--) {
                    html.push("</div><div class='ace_gutter-cell' style='height:", config.lineHeight, "px'>\xA6");
                }

                html.push("</div>");
            }
            this.element = dom.setInnerHtml(this.element, html.join(""));
            this.element.style.height = config.minHeight + "px";
            
            var gutterWidth = this.element.offsetWidth;
            if (gutterWidth !== this.gutterWidth) {
                this.gutterWidth = gutterWidth;
                this._emit("changeGutterWidth", gutterWidth);
            }
        },

        setGutterUpdateFunction : function(opened_file, editor) {
            if (opened_file.indexOf("diff for ") !== 0) {
                //reset update function of gutter layer to original funtion
                var gutter = editor.renderer.$gutterLayer;
                if (gutter.$originalUpdate) {
                    gutter.update = gutter.$originalUpdate;
                }
            } else { //opened_file.indexOf("diff for ") === 0
                //use own update function for gutter layer to set line numbers
                var gutter = editor.renderer.$gutterLayer;
                if (gutter.$originalUpdate === undefined) { 
                    gutter.$originalUpdate = gutter.update;
                }
                gutter.update = this.customUpdate;
            }
        }

    };

    return GitEditorVis;
})();

});
