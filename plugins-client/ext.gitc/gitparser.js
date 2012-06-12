/**
 * TODO
 * 
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

define(function(require, exports, module) {

module.exports = (function() {
    
    function GitDiffParser() {
    }

    GitDiffParser.prototype = {

        parseShortStatus : function(status, stream, callback) {

            // git-status man:
            // 
            //X          Y     Meaning
            //-------------------------------------------------
            //          [MD]   not updated
            //M        [ MD]   updated in index
            //A        [ MD]   added to index
            //D         [ M]   deleted from index
            //R        [ MD]   renamed in index
            //C        [ MD]   copied in index
            //[MARC]           index and work tree matches
            //[ MARC]     M    work tree changed since index
            //[ MARC]     D    deleted in work tree
            //-------------------------------------------------
            //D           D    unmerged, both deleted
            //A           U    unmerged, added by us
            //U           D    unmerged, deleted by them
            //U           A    unmerged, added by them
            //D           U    unmerged, deleted by us
            //A           A    unmerged, both added
            //U           U    unmerged, both modified
            //-------------------------------------------------
            //?           ?    untracked
            //-------------------------------------------------

            var key_map = {A: 'added', D: 'deleted', M: 'modified', R: 'renamed', C: 'copied', U: 'unmerged'};

            var result = { staging_area: {added: [], deleted: [], modified: [], renamed: [], copied: [], unmerged: []},
                           working_dir : {added: [], deleted: [], modified: [], renamed: [], copied: [], unmerged: []} };

            if(stream == "stderr"){
                return result;
            }

            var files = status.split("\n"); files.pop();
            var file;

            for(var i=0; i<files.length; i++){
                file = files[i];

                if(file[0] != ' ' && file[0] != '?') {
                    result.staging_area[key_map[file[0]]].push(file.slice(3,file.length));
                }
                if(file[1] != ' ') {
                    if(file[1] == '?'){ //untracked means that is added on working dir side
                        result.working_dir.added.push(file.slice(3,file.length));

                    } else {
                        result.working_dir[key_map[file[1]]].push(file.slice(3,file.length));
                    }
                }
            }

            if(callback) {
                callback(result);
            }

            return result;
        },

        parseDiffForChangesInFile : function(diff, stream) {

        }
        
    };

    return GitDiffParser;
})();

});