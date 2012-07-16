/**
 * TODO
 * 
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

define(function(require, exports, module) {
var Range = require("ace/range").Range;

/**
 * Creates a new DOM Element.
 *
 * @param label The element's name.
 * @param attr A map defining the element's attributes.
 */
function elem(label, attr) {
    attr = attr || {};

    var e = document.createElement(label);
    var keys = Object.keys(attr);

    for (var i = 0; i < keys.length; ++i) {
        e.setAttribute(keys[i], attr[keys[i]]);
    }
    return e;
}

module.exports = (function() {
    
    function GitEditorVis(gitccommands) {
        this.gitcCommands = gitccommands;
        this.all_changes  = {};
        this.currentEditor= undefined;
        this.currentFile  = undefined;
        this.new_annotations     = {};
        this.current_annotations = {};
    }

    GitEditorVis.prototype = {

        onOpenFile : function(e){
            if(!e.editor) return;
            //initally set read only, needed due to beforeswitch event is triggered too late
            if (e.doc.type !== "diff") {
                e.editor.amlEditor.$editor.setReadOnly(false);
            } else {
                e.editor.amlEditor.$editor.setReadOnly(true);
            }
        },

        onTabSwitch : function(e){
            // only code editors are of our concern
            if (e.nextPage.$editor.path !== "ext/code/code") {
                return;
            }

            // update own state, adjust gutter to our needs
            this.currentFile = this.getFilePath(e.nextPage.id);
            this.currentEditor = e.nextPage.$editor.amlEditor.$editor;
            this.setGutterUpdateFunction(this.currentFile, this.currentEditor);

            if (e.nextPage.$doc.type === "diff") {
                //diff view is read only
                this.currentEditor.setReadOnly(true);
            } else {
                this.currentEditor.setReadOnly(false);
                //treat the file if not done yet
                if (!this.all_changes[this.currentFile]) {
                    // fetch change information fetch
                    this.gitcCommands.send("git diff -U0 " + this.currentFile, this.addChanges.bind(this));
                    this.gitcCommands.send("git diff --cached -U0 " + this.currentFile, this.addChanges.bind(this));
                    //register on editor evetns (TODO: but only once)
                    this.currentEditor.on("mousemove", this.onMouseMove.bind(this));
                    this.currentEditor.on("change", this.onEditorChange.bind(this));
                }
            }
        },

        /**
         * On save fetch new diff data from git.
         */
        onSaveFile : function(e) {         
            if (e.doc.editor.path !== "ext/code/code") {
                return;
            }
            this.new_annotations[this.currentFile] = undefined;
            this.all_changes[this.currentFile] = undefined;
            this.gitcCommands.send("git diff -U0 " + this.currentFile, this.addChanges.bind(this));
            this.gitcCommands.send("git diff --cached -U0 " + this.currentFile, this.addChanges.bind(this));
        },

        onEditorChange : function(e) {
            this.new_annotations[this.currentFile] = undefined;
            this.all_changes[this.currentFile] = undefined;
            var file_content = this.currentEditor.getSession().getValue();
            this.gitcCommands.send("gitcdiff -U0 " + this.currentFile, this.addChanges.bind(this), {new_file_content: file_content});
            this.gitcCommands.send("gitcdiff --cached -U0 " + this.currentFile, this.addChanges.bind(this), {new_file_content: file_content});
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
				annotation.markerId = this.currentEditor.getSession().addMarker(
                    new Range(annotation.row, 0, annotation.row, 1), "gitc-added-" + annotation.status, "background", true);
            } else if (annotation.type == "changed") {
				annotation.markerId = this.currentEditor.getSession().addMarker(
                    new Range(annotation.row, 0, annotation.row, 1), "gitc-changed-" + annotation.status, "background", true);
            } else if (annotation.type == "deleted") {
    			annotation.markerId = this.currentEditor.getSession().addMarker(
                    new Range(annotation.row, 0, annotation.row, 1), "gitc-removed-" + annotation.status, "background", true);
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
            var annotation = this.current_annotations[filename][status][line];
            if (!annotation) {
                return this.createAnnotation(line+1, "deleted", chunk, msg, status);
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
            if (!this.current_annotations[this.currentFile]) {
                return;
            }

            var file_annotations = this.current_annotations[this.currentFile]
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
            revertLink.innerText = annotation.status == "staged" ? "Unstage" : "Discard";
            revertLink.setAttribute("onclick", function(e) {
                console.log('Revert all changes belonging to this chunk.');
            });
            
            var commitRevertP = document.createElement('p');
            commitRevertP.className = "gitc-commit-revert";
            commitRevertP.appendChild(commitLink);
            commitRevertP.appendChild(revertLink);
            
            return commitRevertP;
        },
        
        undecorate : function(filename, editor) {
            if (this.current_annotations[filename]) {
                var annotations = this.current_annotations[filename];
                if (annotations.staged) {
					_.each(Object.keys(annotations.staged), function(row) {
						var annotation = annotations.staged[row];
						editor.getSession().removeMarker(annotation.markerId);
					});
				}

				if (annotations.unstaged) {
					_.each(Object.keys(annotations.unstaged), function(row) {
						var annotation = annotations.unstaged[row];
						editor.getSession().removeMarker(annotation.markerId);
					});
				}
            }
        },

        decorate : function(filename) {
            if (filename !== this.currentFile) {
                return;
            }
            this.createTooltips();
            
            if (this.all_changes[this.currentFile].unstaged && this.all_changes[this.currentFile].staged && this.new_annotations[this.currentFile]) {
                //beforehand undecorate old annotations
                this.undecorate(filename, this.currentEditor);
                //add gutter decoration for all annotations
                var stagedAnnotations = this.new_annotations[this.currentFile].staged;
                for (var i in stagedAnnotations) {
                    this.markGutterLine(stagedAnnotations[i]);
                }

				var unstagedAnnotations = this.new_annotations[this.currentFile].unstaged;
                for (var i in unstagedAnnotations) {
                    this.markGutterLine(unstagedAnnotations[i]);
                }
                this.current_annotations[filename] = this.new_annotations[filename];
                this.new_annotations[filename] = undefined;
            }
        },

		onMouseMove : function(e) {
			var layer = document.getElementsByClassName("ace_layer ace_marker-layer")[1];
			var existingTooltips = layer.getElementsByClassName('gitc-tooltip');
			for (var i = 0; i < existingTooltips.length; i++) {
				layer.removeChild(existingTooltips[i]);
			}
			var row = e.getDocumentPosition().row;
			var column = e.getDocumentPosition().column;
			
			if (column == 0 && this.current_annotations[this.currentFile]) {
				var tooltip = document.createElement('div');
                tooltip.className = "gitc-tooltip";
				tooltip.setAttribute("style", "left: " + (e.domEvent.layerX + 10).toString() + "px; top: " + e.domEvent.layerY.toString() + "px;");

				if (this.current_annotations[this.currentFile].staged) {
					var stagedAnnotation = this.current_annotations[this.currentFile].staged[row.toString()];
					if (stagedAnnotation) {
						var stagedDiv = document.createElement('div');
						stagedDiv.className = "staged-" + stagedAnnotation.type;
                        //Blub
						
						var stagedText = stagedAnnotation.text;
						var prevRow = row-1;
						var prevAnnotation = this.current_annotations[this.currentFile].staged[prevRow.toString()];
						while (prevAnnotation && prevAnnotation.type == stagedAnnotation.type) {
							stagedText = prevAnnotation.text + "\n" + stagedText;
							prevAnnotation = this.current_annotations[this.currentFile].staged[(--prevRow).toString()];
						}
						
						var nextRow = row+1;
						var nextAnnotation = this.current_annotations[this.currentFile].staged[nextRow.toString()];
						while (nextAnnotation && nextAnnotation.type == stagedAnnotation.type) {
							stagedText = stagedText + "\n" + nextAnnotation.text;
							nextAnnotation = this.current_annotations[this.currentFile].staged[(++nextRow).toString()];
						}
						
						var stagedParagraphs = stagedText.split("\n");
						for (var i = 0; i < stagedParagraphs.length; i++) {
							var stagedParagraph = document.createElement('p');
							stagedParagraph.innerText = stagedParagraphs[i];
							stagedDiv.appendChild(stagedParagraph);
						}
						tooltip.appendChild(stagedDiv);
					}
				}
				
				if (this.current_annotations[this.currentFile].unstaged) {
					var unstagedAnnotation = this.current_annotations[this.currentFile].unstaged[row.toString()];
					if (unstagedAnnotation) {
						var unstagedDiv = document.createElement('div');
						unstagedDiv.className = "unstaged-" + unstagedAnnotation.type;
						
						var unstagedText = unstagedAnnotation.text;
						var prevRow = row-1;
						var prevAnnotation = this.current_annotations[this.currentFile].unstaged[prevRow.toString()];
						while (prevAnnotation && prevAnnotation.type == unstagedAnnotation.type) {
							unstagedText = prevAnnotation.text + "\n" + unstagedText;
							prevAnnotation = this.current_annotations[this.currentFile].unstaged[(--prevRow).toString()];
						}
						
						var nextRow = row+1;
						var nextAnnotation = this.current_annotations[this.currentFile].unstaged[nextRow.toString()];
						while (nextAnnotation && nextAnnotation.type == unstagedAnnotation.type) {
							unstagedText = unstagedText + "\n" + nextAnnotation.text;
							nextAnnotation = this.current_annotations[this.currentFile].unstaged[(++nextRow).toString()];
						}

						var unstagedParagraphs = unstagedText.split("\n");
						for (var i = 0; i < unstagedParagraphs.length; i++) {
							var unstagedParagraph = document.createElement('p');
							unstagedParagraph.innerText = unstagedParagraphs[i];
							unstagedDiv.appendChild(unstagedParagraph);
						}
						tooltip.appendChild(unstagedDiv);
					}
				}
				if (tooltip.children.length > 0) {
					layer.appendChild(tooltip);
				}
			}
		},
        
        annotateChunks : function(chunks, status, filename) {
            if (!this.new_annotations[filename]) {
				this.new_annotations[filename] = {};
            }
            
            if (!this.new_annotations[filename][status]) {
                this.new_annotations[filename][status] = {};
                
                var deletedLines = [];

				//create 'added' annotations
                for (var i = 0; i < chunks.length; i++) {
            		var chunk = chunks[i];
    				for (var j = 0; j < chunk.lines.length; j++) {
    					var line = chunk.lines[j];
                        if (line.status == "added") {
                            var annotation = this.createAnnotation(line.number_new-1, line.status, chunk, line.content, status);
                            this.new_annotations[filename][status][annotation.row.toString()] = annotation;
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
                        this.new_annotations[filename][status][annotation.row.toString()] = annotation;
                    }
				}
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
            } else {
                self.currentEditor.renderer.$gutterLayer.update({
                    firstRow: firstLineIndex, lastRow: lastLineIndex, reset: true})
            }
        },

        customUpdate: function(config) {
            if (config.reset === true) {
                this.lines = undefined;
            }

            if (config.lines && config.override === true) {
                this.lines = config.lines;
            } else if (this.lines) {
                this.$config = config;
                config.lines = this.lines;
            } else if (config.lastRow !== undefined) {
                return this.$originalUpdate(config);
            } else {
                throw ("Invalid State: neither lines nor start or end rows given (config: " +
                    config + ")");
            }
            var editor = require("ext/gitc/gitc").gitEditorVis.currentEditor;
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
        },

        showGitButtons: function(row) {
            var lines = document.getElementsByClassName("ace_layer ace_gutter-layer")[0].childNodes;
            var lineHeight = lines[row].clientHeight;
            var div = elem("div", {
                style: "top: " + (lineHeight * row) + "px;",
                class: "stage-buttons"});
            var stage = elem("a", {href: "#"});
            stage.innerHTML = "Stage";
            var discard = elem("a", {href: "#"});
            discard.innerHTML = "Discard";
            var icon = elem("div", {class: "spacer"});
            icon.innerHTML = "&nbsp;";
            var content = elem("div", {class: "content"})
            content.appendChild(stage);
            content.appendChild(discard);

            div.appendChild(icon)
            div.appendChild(content);

            lines[row].appendChild(div);
        }

    };

    return GitEditorVis;
})();

});
