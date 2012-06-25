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
            } else if (annotation.type == "deleted") {
                //this.currentEditor.getSession().addMarker(new Range(annotation.row, 1, annotation.row, 10), "gitc-removed", "background");
                this.currentEditor.renderer.addGutterDecoration(annotation.row, "gitc-removed");
            };
            
            this.addTooltip(annotation);
            
        },
        
        createAnnotation : function(line, type, msg, status) {
          var annotation = {
            row: line,
            type: type,
            text: msg,
            status: status,
            tooltip: this.createTooltip(msg, type, line)
          };
          
          return annotation;
        },
        
        createTooltip : function(msg, type, line) {
          if (type == "added")
		  	return;

		  var anno = this.annotations[(line-1).toString()];
		  
		  if (anno && anno.type == type) {
			anno.text += "\n" + msg;
			var p = document.createElement('p');
			p.innerText = msg;
			anno.tooltip.appendChild(p);
			return;
		  } else {
		  	var tooltip = document.createElement('div');
			var p = document.createElement('p');
			p.innerText = msg;
			tooltip.appendChild(p);
	        tooltip.className = 'gitc-tooltip';
			return tooltip;
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
            } else {
                
            }
                
                
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
            for (var i in this.annotations) {
    		    this.addTooltip(this.annotations[i]);
			}
		},
        
        addTooltip : function(annotation) {
            if (!annotation.tooltip)
				return;

			var gutterLayer = document.getElementById('q11').children[2].children[1];
            var renderer = this.currentEditor.renderer;
            var firstLineIndex = renderer.getFirstVisibleRow();
            var lastLineIndex = renderer.getLastVisibleRow();
            //console.log("lastLine: " + lastLineIndex);
            //console.log("firstLine: " + firstLineIndex);
            //console.log("annoLine: " + annotation.row);
            if (firstLineIndex <= annotation.row && lastLineIndex >= annotation.row) {
                var el = gutterLayer.children[annotation.row-firstLineIndex];
				el.appendChild(annotation.tooltip);
            }
        }

    };

    return GitEditorVis;
})();

});