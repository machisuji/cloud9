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
        
        markGutterLine : function(annotation) {
			var session = this.currentEditor.getSession();
            
            if (annotation.type == "added") {
                //this.currentEditor.getSession().addMarker(new Range(annotation.row, 1, annotation.row, 10), "gitc-added", "background");
                this.currentEditor.renderer.addGutterDecoration(annotation.row, "gitc-added");
            } else if (annotation.type == "changed") {
                //this.currentEditor.getSession().addMarker(new Range(annotation.row, 1, annotation.row, 10), "gitc-changed", "background");
                this.currentEditor.renderer.addGutterDecoration(annotation.row, "gitc-changed");
            //} else if (annotation.type == "deleted") {
                //this.currentEditor.getSession().addMarker(new Range(annotation.row, 1, annotation.row, 10), "gitc-removed", "background");
                //this.currentEditor.renderer.addGutterDecoration(annotation.row, "gitc-removed");
            };
            
            this.addTooltip(annotation);
            
        },
        
        createAnnotation : function(line, type, msg, status) {
          var annotation = {
            row: line,
            type: type,
            text: msg,
            status: status
          };
          
          this.createTooltip(annotation);
          return annotation;
        },
        
        createTooltips : function() {
            var lines = this.currentEditor.getSession().getLength();
            for (var i = 0; i < lines; i++) {
                var annotation = this.annotations[this.currentFile][i.toString];
                if (annotation) {
                    //create tooltip for this annotation
                    var nextAnnotation;
                    while (++i < lines && this.annotation[this.currentFile][i.toString]) {
                        nextAnnotation = this.annotation[this.currentFile][i.toString];
                        if (nextAnnotation.type == annotation.type) {
                            //merge annotation text
                        }
                    }
                }
            }
        },
        
        belongsToGroup : function(annotation) {
            
        },
        
        createTooltip : function(annotation) {
          if (annotation.type == "added")
		  	return;
          var prevAnno = this.annotations[this.currentFile][(annotation.row-1).toString()];
          var nextAnno = this.annotations[this.currentFile][(annotation.row+1).toString()];
          
          var p = document.createElement('p');
          p.innerText = annotation.text;
		  
		  if (prevAnno && prevAnno.type == annotation.type) {
			prevAnno.text += "\n" + annotation.text;
			prevAnno.tooltip.insertBefore(p, prevAnno.tooltip.lastChild);
		  } else {
    	    annotation.tooltip = document.createElement('div');
            annotation.tooltip.className = 'gitc-tooltip';
            annotation.tooltip.appendChild(p);
            
            var commitLink = document.createElement('a');
            commitLink.innerText = "Commit";
            commitLink.onClick = function(e) {
              //commit changes of this annotation  
            };
            
            var revertLink = document.createElement('a');
            revertLink.innerText = "Revert";
            revertLink.onClick = function(e) {
              //revert changes of this annotation  
            };
            
            var commitRevertDiv = document.createElement('div');
            commitRevertDiv.appendChild(commitLink);
            commitRevertDiv.appendChild(revertLink);
            
            
            if (nextAnno && nextAnno.type == annotation.type) {
                annotation.text += "\n" + nextAnno.text;
                while(nextAnno.firstChild) {
                    var firstChild = nextAnno.firstChild;
                    annotation.tooltip.insertBefore(firstChild, annotation.tooltip.lastChild);
                    nextAnno.removeChild(firstChild);
                }
            }
		  }
        },
        
        undecorate : function(closedFile) {
            if (this.annotations[closedFile]) {
                var annotations = this.annotations[closedFile];
                for (var annotation in annotations) {
                    this.undecorateGutterLine(annotations[annotation]);
                }
            }
        },
        undecorateGutterLine : function(annotation) {
            if (annotation.type == "deleted") {
                this.currentEditor.renderer.removeGutterDecoration(annotation.row, "gitc-removed");
            } else if (annotation.type == "added") {
                this.currentEditor.renderer.removeGutterDecoration(annotation.row, "gitc-added");
            } else if (annotation.type == "changed") {
                this.currentEditor.renderer.removeGutterDecoration(annotation.row, "gitc-changed");
            }
        },

        onTabSwitch : function(e){
            var closed_file = e.currentTarget.$activepage? this.getFilePath(e.currentTarget.$activepage.id) : undefined;
            var opened_file = this.getFilePath(e.nextPage.id);
            this.currentFile = opened_file;

            if (e.nextPage.$editor.path !== "ext/code/code")
                return;

            this.currentEditor = e.nextPage.$editor.amlEditor.$editor;
            //document change
            //this.currentEditor.on("change", function(evt) {
                // instead of change there are also 
                // "changeMode", "tokenizerUpdate","changeTabSize", "changeWrapLimit", 
                //"changeWrapMode", "changeFold", "changeFrontMarker", "changeBackMarker", 
                //"changeBreakpoint", "changeAnnotation", "changeOverwrite", 
                //"changeScrollTop", "changeScrollLeft", "changeCursor", "changeSelection"

                //console.log(evt)};
            
            console.log("tab switch from: " + closed_file + " to: " + opened_file);

            this.undecorate(closed_file);
            
            //unstaged changes
            this.gitcCommands.send("git diff " + opened_file, this.addUnstagedChanges.bind(this));
            //staged changes
            this.gitcCommands.send("git diff --cached " + opened_file, this.addStagedChanges.bind(this));
            //maintain gutter tooltips
            this.currentEditor.renderer.scrollBar.addEventListener("scroll", this.onScroll.bind(this));
        },
        
        decorate : function(filename) {
            if (filename != this.currentFile) {
                return;
            }
            //this.createTooltips();
            
            if (this.all_changes[this.currentFile].unstaged && this.all_changes[this.currentFile].staged) {
                //add gutter decoration for all annotations
                var annotations = this.annotations[this.currentFile];
                for (var i in annotations) {
                    this.markGutterLine(annotations[i]);
                }
            }
        },
        
        annotateChunks : function(chunks, status, filename) {
            if (!this.annotations[filename]) {
                this.annotations[filename] = {};
                
                var annotations = this.annotations[filename];
                for (var i = 0; i < chunks.length; i++) {
        			var chunk = chunks[i];
    				for (var j = 0; j < chunk.lines.length; j++) {
    					var line = chunk.lines[j];
    					var annotation = this.createAnnotation(line.number_new-1, line.status, line.content, status);
                        if (this.isChangeAnnotation(annotation, filename)) {
                            annotation.type = "changed";
                        }
    					annotations[annotation.row.toString()] = annotation;
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

        addUnstagedChanges : function(output, parser) {
            var changes = parser.parseDiff(output.data, output.stream);
            var filename = output.args[output.args.length-1];
            if (!this.all_changes[filename]) {
                this.all_changes[filename] = {};
            }
            this.all_changes[filename].unstaged = changes;
            
            if (changes.length == 0) {
                return;
            }
            
            //create annotations for unstaged changes
            for (var i = 0; i < changes.length; i++) {
    			var change = changes[i];
				this.annotateChunks(change.chunks, "unstaged", filename);
			}
            this.decorate(filename);
        },
        
        //Bla
        //Blub

        addStagedChanges : function(output, parser) {
            var changes = parser.parseDiff(output.data, output.stream);
            var filename = output.args[output.args.length-1];
            if (!this.all_changes[filename]) {
                this.all_changes[filename] = {};
            }
            this.all_changes[filename].staged = changes;
            
            if (changes.length == 0) {
                return;
            }
            
            //create annotations for unstaged changes
            for (var i = 0; i < changes.length; i++) {
        		var change = changes[i];
				this.annotateChunks(change.chunks, "staged", filename);
			}
            this.decorate(filename);
        },

        getFilePath : function(filePath) {
            if (typeof filePath === "undefined")
                filePath = tabEditors.getPage().$model.data.getAttribute("path");
            if (filePath.indexOf("/workspace/") === 0)
                filePath = filePath.substr(11);

            return filePath;
        },

		onScroll : function(e) {
            for (var i in this.annotations[this.currentFile]) {
                var annotation = this.annotations[this.currentFile][i];
                if (annotation.type == "deleted") {
                    this.decorateAsDeleted(annotation);
                }
                this.addTooltip(annotation);
			}
		},
        
        addTooltip : function(annotation) {
            if (!annotation.tooltip)
				return;

			var gutterLayer = document.getElementById('q11').children[2].children[1];
            var renderer = this.currentEditor.renderer;
            var firstLineIndex = renderer.getFirstVisibleRow();
            var lastLineIndex = renderer.getLastVisibleRow();
            if (firstLineIndex < annotation.row && lastLineIndex >= annotation.row) {
                var el = gutterLayer.firstChild;
                while (el.innerText != annotation.row.toString()) {
                    el = el.nextSibling;
                }
                if (annotation.type == "deleted") {
                    el.nextSibling.appendChild(annotation.tooltip);
                } else {
                    el.appendChild(annotation.tooltip);
                }
            }
        },
        
        decorateAsDeleted : function(annotation) {
            var gutterLayer = document.getElementById('q11').children[2].children[1];
            var renderer = this.currentEditor.renderer;
            var firstLineIndex = renderer.getFirstVisibleRow();
            var lastLineIndex = renderer.getLastVisibleRow();
            
            if (firstLineIndex < annotation.row && lastLineIndex > annotation.row) {
                var prevCell = gutterLayer.firstChild;
                var nextCell = prevCell.nextSibling;
                
                while (prevCell.innerText != annotation.row.toString()) {
                    prevCell = prevCell.nextSibling;
                    nextCell = prevCell.nextSibling;
                }
                
                var cell = document.createElement('div');
                cell.classList.add("ace_gutter-cell");
                cell.classList.add("gitc-removed");
                cell.setAttribute("style", "height: 2px");
                
                prevCell.setAttribute("style", "height: 15px");
                nextCell.setAttribute("style", "height: 15px");
                
                gutterLayer.insertBefore(cell, nextCell);
            }
        },
        
        //replaces all numbers in gutter by contents of replace (array of strings) starting at line index "from"
        replaceGutterNumbers : function(from, replace) {
            var gutterCells = document.getElementsByClassName("ace_gutter-cell");
            var firstLineIndex = this.currentEditor.renderer.getFirstVisibleRow();
            if (firstLineIndex <= from) {
                from -= firstLineIndex;
                for (var i = 0; i < replace.length; i++) {
                    var gutterCell = gutterCells[i+from];
                    gutterCell.innerText = replace[i];
                }
            }
        }

    };

    return GitEditorVis;
})();

});
