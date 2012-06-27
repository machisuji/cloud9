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
                this.currentEditor.renderer.addGutterDecoration(annotation.row, "gitc-added");
            } else if (annotation.type == "changed") {
                this.currentEditor.renderer.addGutterDecoration(annotation.row, "gitc-changed");
            };
        },
        
        createAnnotation : function(line, type, msg, status) {
          var annotation = {
            row: line,
            type: type,
            text: msg,
            status: status,
            tooltip: undefined
          };
          
          return annotation;
        },
        
        createTooltips : function() {
            var lines = this.currentEditor.getSession().getLength();
            for (var i = 1; i <= lines; i++) {
                var annotation = this.annotations[this.currentFile][i.toString()];
                if (annotation) {
                    //create tooltip for this annotation
                    var p = document.createElement('p');
                    p.innerText = annotation.text;
                    
                    annotation.tooltip = document.createElement('div');
                    annotation.tooltip.className = 'gitc-tooltip';
                    annotation.tooltip.appendChild(p);
                    
                    var commitLink = document.createElement('a');
                    commitLink.innerText = "Commit";
                    commitLink.setAttribute("onclick", function(e) {
                        console.log('Commit all changes belonging to this chunk.');
                    });
                    
                    var revertLink = document.createElement('a'); //button to revert
                    revertLink.innerText = "Revert";
                    revertLink.setAttribute("onclick", function(e) {
                        console.log('Revert all changes belonging to this chunk.');
                    });
                    
                    var commitRevertP = document.createElement('p'); //button to commit
                    commitRevertP.className = "gitc-commit-revert";
                    commitRevertP.appendChild(commitLink);
                    commitRevertP.appendChild(revertLink);
                    annotation.tooltip.appendChild(commitRevertP);
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
            this.createTooltips();
            
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
            if (this.annotations[this.currentFile]) 
                this.addMissingDecoration();
		},
        
        addMissingDecoration : function() {
            var gutterCells = document.getElementsByClassName('ace_gutter-cell');
            var firstLineIndex = this.currentEditor.renderer.getFirstVisibleRow();
            for (var i = 0; i < gutterCells.length; i++) {
                var annotation = this.annotations[this.currentFile][(firstLineIndex+i).toString()];
                if (!annotation)
                    continue;
                    
                var cell = gutterCells[i];
                
                //add deleted line marker, if not at start of visible gutter area (otherwise, marker would not be visible anyway)
                if (annotation.type == "deleted" && i > 0) {
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
