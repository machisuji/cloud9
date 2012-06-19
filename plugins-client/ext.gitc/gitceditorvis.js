/**
 * TODO
 * 
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

define(function(require, exports, module) {


module.exports = (function() {
    
    function GitEditorVis(gitccommands) {
        this.gitcCommands = gitccommands;
        this.currentEditor = undefined;
        this.changes = undefined;
    }

    GitEditorVis.prototype = {

    	onTabSwitch : function(e){
            var closed_file = e.currentTarget.$activepage? this.getFilePath(e.currentTarget.$activepage.id) : undefined;
            var opened_file = this.getFilePath(e.nextPage.id);
            this.currentEditor = e.nextPage.$editor.amlEditor.$editor;
            this.currentEditor.renderer.scrollBar.addEventListener("scroll", function(e){
                    console.log(e);
                });
            //document change
            //this.currentEditor.on("change", function(evt) {
                // instead of change there are also 
                // "changeMode", "tokenizerUpdate","changeTabSize", "changeWrapLimit", 
                //"changeWrapMode", "changeFold", "changeFrontMarker", "changeBackMarker", 
                //"changeBreakpoint", "changeAnnotation", "changeOverwrite", 
                //"changeScrollTop", "changeScrollLeft", "changeCursor", "changeSelection"

                //console.log(evt)};
            
            console.log("tab switch from: " + closed_file + " to: " + opened_file);

            //unstaged changes
            this.gitcCommands.send("diff " + opened_file, this.addUnstagedChanges.bind(this));
            //staged changes
            this.gitcCommands.send("diff --cached " + opened_file, this.addStagedChanges.bind(this));


        },

        addUnstagedChanges : function(diff_output, stream, parser) {
            var changes = parser.parseDiff(diff_output, stream);
            console.log(changes);
            //TODO
        },

        addStagedChanges : function(diff_output, stream, parser) {
            var changes = parser.parseDiff(diff_output, stream);
            console.log(changes);
            //TODO
        },

        getFilePath : function(filePath) {
            if (typeof filePath === "undefined")
                filePath = tabEditors.getPage().$model.data.getAttribute("path");
            if (filePath.indexOf("/workspace/") === 0)
                filePath = filePath.substr(11);

            return filePath;
        },

    };

    return GitEditorVis;
})();

});