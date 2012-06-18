/**
 * TODO
 * 
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

define(function(require, exports, module) {

module.exports = (function() {
    
    function GitDiffParser() {
        var _self =this;
    }

    GitDiffParser.prototype = {

        
        /*
         * Returns the changed files found in the output of the 'git status -s' 
         * command and returns the changed files.
         */
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

            var files = { staging_area: {added: [], deleted: [], modified: [], renamed: [], copied: [], unmerged: []},
                           working_dir : {added: [], deleted: [], modified: [], renamed: [], copied: [], unmerged: []} };

            if(stream == "stderr"){
                return undefined;
            }

            var files = status.split("\n"); files.pop();
            var file;

            for(var i=0; i<files.length; i++){
                file = files[i];

                if(file[0] != ' ' && file[0] != '?') {
                    files.staging_area[key_map[file[0]]].push(file.slice(3,file.length));
                }
                if(file[1] != ' ') {
                    if(file[1] == '?'){ //untracked means that is added on working dir side
                        files.working_dir.added.push(file.slice(3,file.length));

                    } else {
                        files.working_dir[key_map[file[1]]].push(file.slice(3,file.length));
                    }
                }
            }

            if(callback) {
                callback(files);
            }

            return files;
        },

        /*
         * Returns the chunks found in the output of either the 
         * 'git diff' for unstaged changes,
         * 'git diff --cached' for staged changes or 
         * 'git diff HEAD' for all staged or unstaged changes.
         */
        parseDiff : function(diff, stream) {
            var files = [];

            if(stream == "stderr"){
                return result;
            }

            //separate diff for each contained file
            diff = "\n" + diff;
            var diffs = diff.split("\ndiff --git");
            diffs.shift(); // Omit leading empty field

            for(var i=0; i < diffs.length; i++) {
                var file = { name: {old: "", new: ""},
                             diff_header: "",
                             chunks: [] };

                //split file info from chunks
                var chunks = diffs[i].split("\n@@");
                file.diff_header = "diff --git" + chunks[0]; //reappend prefix
                var file_info = chunks[0].split("\n");
                chunks.shift();

                file.name.old = file_info[2].slice(5,file.length);
                file.name.new = file_info[3].slice(5,file.length);

                //parse each single chunk
                for(var j=0; j < chunks.length; j++) {
                    var chunk = "@@" + chunks[j] //reappend prefix

                    //separate header from diff text
                    var header = chunk.match(/^@@.*@@/)[0];
                    var first_line_end = chunk.search("\n");
                    var text = chunk.slice(first_line_end+1,chunk.length);

                    file.chunks.push(this.parseChunk(header, text));
                }

                files.push(file);
            }

            return files;
        },

        parseChunk : function(header, chunk_text) {
            var chunk = {header: header,
                         text: chunk_text,
                         lines: []}

            var h = header.match(/@@ \-(\d+),(\d+)? \+(\d+),(\d+)? @@/);
            var position_old = parseInt(h[1]);
            var position_new = parseInt(h[3]);

            var lines = chunk_text.split("\n");
            for(var i=0; i<lines.length; i++) {
                var current_line = lines[i];
                if(current_line == "") {
                    continue;
                }
                if(current_line[0] == ' ') {
                    position_old++; position_new++;
                    continue;
                }
                var line = {content: current_line.slice(1,current_line.length)};

                if(current_line[0] == '+') {
                    line.status = 'added';
                    line.number_new = position_new;
                    position_new++;
                } else if(current_line[0] == '-') {
                    line.status = 'deleted';
                    line.number_new = position_new;
                    line.number_old = position_old;
                    position_old++;
                }

                chunk.lines.push(line);

            }
            return chunk;
        }
        
    };

    return GitDiffParser;
})();

});