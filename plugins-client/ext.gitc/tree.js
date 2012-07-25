/**
 * Gitc diff tree (C) 2012 Markus Kahl, Stephanie Platz and Patrick Schilf based on:
 *
 * File Tree for the Cloud9 IDE
 *
 * @copyright 2012, Cloud9 IDE, Inc.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

define(function(require, exports, module) {

var ide = require("core/ide");
var ext = require("core/ext");
var util = require("core/util");
var settings = require("ext/settings/settings");
var panels = require("ext/panels/panels");
var markup = require("text!ext/gitc/tree.xml");
var commands = require("ext/commands/commands");

require("ext/gitc/lib/underscore-min");

var showHideScrollPos;

function $trScroll() {
    if (this.$scrollTimer)
        clearTimeout(this.$scrollTimer);

    showHideScrollPos = diffFiles.$ext.scrollTop;

    // Set to -1 in case the user scrolls before the tree is done loading,
    // in which case we don't want to set the scroll pos to the saved one
    this.scrollPos = -1;

    this.$scrollTimer = setTimeout(function() {
        var settingsData       = settings.model.data;
        var settingProjectTree = settingsData.selectSingleNode("auto/projecttree");
        if (settingProjectTree)
            apf.xmldb.setAttribute(settingProjectTree, "scrollpos", diffFiles.$ext.scrollTop);
    }, 1000);
}

function $cancelWhenOffline() {
    if (!ide.onLine && !ide.offlineFileSystemSupport)
        return false;
}

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

function ranges(is, result) {
  result = result || [];
  if (is.length === 0) return result;
  if (result.length === 0) {
    return ranges(is.slice(1), [[is[0], is[0]]]);
  } else {
    var range = result[result.length - 1];
    var head = is[0];

    if (range[1] + 1 === head) {
      range[1] = head;
      return ranges(is.slice(1), result);
    } else {
      result.push([head, head]);
      return ranges(is.slice(1), result);
    }
  }
}

module.exports = ext.register("ext/gitc/tree", {
    name             : "gitc diff tree",
    dev              : "Markus Kahl, Stephanie Platz, Patrick Schilf",
    alone            : true,
    type             : ext.GENERAL,
    markup           : markup,

    defaultWidth     : 200,

    deps             : [],

    expandedNodes    : [],
    loadedSettings   : 0,
    expandedList     : {},
    treeSelection    : { path : null, type : null },
    loading          : false,
    changed          : false,
    animControl      : {},
    nodes            : [],
    offline          : false,

    hook : function(){
        var _self = this;
        
        this.markupInsertionPoint = colLeft;

        // Register this panel on the left-side panels
        panels.register(this, {
            position : 1100,
            caption: "gitc",
            "class": "gitc",
            command: "opengitcpanel"
        });
        
        commands.addCommand({
            name: "opengitcpanel",
            hint: "show the gitc panel",
            bindKey: {mac: "Command-G", win: "Ctrl-G"},
            exec: function () {
                _self.show();
            }
        });

        ide.addEventListener("settings.load", function(e){
            var model = e.model;
            (davProject.realWebdav || davProject).setAttribute("showhidden",
                apf.isTrue(model.queryValue('auto/projecttree/@showhidden')));

            _self.scrollPos = model.queryValue('auto/projecttree/@scrollpos');

            // auto/projecttree contains the saved expanded nodes
            var strSettings = model.queryValue("auto/difftree");
            if (strSettings) {
                try {
                    _self.expandedNodes = JSON.parse(strSettings);
                }
                catch (ex) {
                    _self.expandedNodes = [ide.davPrefix];
                }

                // Get the last selected tree node
                var savedTreeSelection = model.queryNode("auto/tree_selection");
                if (savedTreeSelection) {
                    _self.treeSelection.path = model.queryValue('auto/tree_selection/@path');
                    _self.treeSelection.type = model.queryValue('auto/tree_selection/@type');
                }

                _self.loadedSettings = 1;
            } else {
                _self.loadedSettings = 2;
            }
        });

        ide.addEventListener("beforesavewarn", function(e) {
            var diff = e.doc.type === "diff";
            return !diff;
        });

        ide.addEventListener("afteropenfile", this.$afteropenfile = function(e) {
            var doc = e.doc; if (!doc.editor || !doc.ranges) return true;
            var editor = e.editor.amlEditor.$editor;
            var markRows = function markRows() {
                _.each(doc.ranges, function(range) {
                    if (range[0] !== "context") {
                        editor.getSession().addMarker(range[1], "gitc-diff-" + range[0], "background");
                    }
                });
            };
            setTimeout(markRows, 25);
        });

        tabEditors.addEventListener("afterswitch", this.$afterswitch = function(e) {
            var doc = e.nextPage.$doc;
            require("ext/gitc/gitc").gitEditorVis.updateLineNumbers(doc.lines, doc.chunkIndices);
        });
    },

    showDiff: function showDiff(title, diff, ranges, lines, status, chunkIndices, update) {
        if (update === undefined) {
            update = false;
        }
        var staged = false;
        var path = "diff for ";
        if (chunkIndices.length > 0 && chunkIndices[0].staged) {
            staged = chunkIndices[0].staged;
            path += "staged ";
        }
        path += title;

        var fileName = title.substring(title.lastIndexOf("/") + 1);

        var node = apf.getXml('<file newfile="1" type="file" size="" changed="1" '
                + 'name="' + fileName + '.diff" path="' + path + '" contenttype="text/plain; charset=utf-8" '
                + 'modifieddate="" creationdate="" lockable="false" hidden="false" '
                + 'executable="false" status="' + status + '"></file>');
        var doc = ide.createDocument(node);
        doc.setValue(diff);
        doc.type = "diff";
        doc.ranges = ranges;
        doc.lines = lines;
        doc.chunkIndices = chunkIndices;

        if (!update) {
            ide.dispatchEvent("openfile", {doc: doc, type: "newfile"});
        } else {
            var ve = require("ext/gitc/gitc").gitEditorVis;
            var editor = ve.currentEditor

            editor.getSession().setValue(diff);
            this.$afteropenfile({doc: doc, editor: editor})
            require("ext/gitc/gitc").gitEditorVis.updateLineNumbers(doc.lines, doc.chunkIndices);
        }

        return doc;
    },

    /**
     * Takes a list of files and turns them into a tree structure.
     * For instance:
     *
     *  [{path: "/foo/bar/run.sh", status: "added"}, {path: "/foo/blah.txt", status: "deleted"}]
     *
     * will become
     *
     *  some sort of tree
     */
    createFileTree: function createFileTree(files, name, path, root) {
        var insert = function insert(tree, path, value) {
            var node = tree;
            for (var i = 0; i < path.length - 1; ++i) {
                var seg = path[i];
                if (node.folders[seg] === undefined) {
                    node.folders[seg] = {path: path.slice(0, i + 1).join("/"), files: [], folders: {}};
                }
                node = node.folders[seg];
            }
            var file = path[path.length - 1];
            if (file !== "") {
                node.files.push(value);
            } else {
                node.status = value.status;
            }
        };
        var tree = {path: ".", files: [], folders: {}};
        if (name) {
            tree.name = name;
        }
        if (path) {
            tree.path = path;
        }
        if (root) {
            tree.root = '1';
        }
        for (var i = 0; i < files.length; ++i) {
            var path = files[i].path.split("/");
            insert(tree, path, files[i]);
        }
        return tree;
    },

    /**
     * Creates a model usable by the tree from the given file paths.
     */
    createModel: function createModel(rootName, files) {
        var makeFile = function makeFile(file) {
            return "<file type='file' path='" + file.path + "' name='" +
                file.path.substring(file.path.lastIndexOf("/") + 1) + "' status='" + file.status + "' />";
        };
        var makeFolder = function makeFolder(folder) {
            var xml = "<folder type='folder' path='" + folder.path + "' name='";
            if (folder.name) {
                xml += folder.name;
            } else {
                xml += folder.path.substring(folder.path.lastIndexOf("/") + 1);
            }
            xml += "'";
            if (folder.root) {
                xml += " root='1'";
            }
            if (folder.status) {
                xml += " status='" + folder.status + "'";
            }
            xml += ">";
            var keys = Object.keys(folder.folders).sort();
            for (var i = 0; i < keys.length; ++i) {
                xml += makeFolder(folder.folders[keys[i]]);
            }
            for (var i = 0; i < folder.files.length; ++i) {
                xml += makeFile(folder.files[i]);
            }
            xml += "</folder>";

            return xml;
        };
        var tree = this.createFileTree(files, rootName, "/workspace/", true);
        var folder = makeFolder(tree);

        return "<data>" + folder + "</data>";
    },

    onReady : function() {
        var _self = this;
        var gcc = require("ext/gitc/gitc").gitcCommands;

        this.updateStatus = function updateStatus() {
            require("ext/gitc/gitc").gitcCommands.send("git status -s", function(output, parser) {
                var st = parser.parseShortStatus(output.data, output.stream);
                var workingDirModel = _self.createModel("Working Directory", st.working_dir.getAll());
                var stageModel = _self.createModel("Stage", st.staging_area.getAll());

                var selectedDiff = diffFiles.selected;
                var selectedStage = stageFiles.selected;

                diffFiles.getModel().load(workingDirModel);
                stageFiles.getModel().load(stageModel);
                if (this.loadedSettings === 1) {
                    var parentNode = diffFiles.queryNode("folder[@root=1]");
                    diffFiles.$setLoadStatus(parentNode, "loaded");
                    diffFiles.slideToggle(apf.xmldb.getHtmlNode(parentNode, diffFiles), 1, true, null, null);

                    var stageRoot = stageFiles.queryNode("folder[@root=1]");
                    stageFiles.$setLoadStatus(stageRoot, "loaded");
                    stageFiles.slideToggle(apf.xmldb.getHtmlNode(stageRoot, stageFiles), 1, true, null, null);
                }
                _self.ready = true;

                // @TODO refactor into function
                if (selectedDiff) {
                    var xmlNode = diffFiles.$model.queryNode('//node()[@path="' +
                        selectedDiff.getAttribute("path") + '" and @type="' +
                        selectedDiff.getAttribute("type") + '"]');
                    if (xmlNode) {
                        diffFiles.select(xmlNode);
                    }
                }
                if (selectedStage) {
                    var xmlNode = stageFiles.$model.queryNode('//node()[@path="' +
                        selectedStage.getAttribute("path") + '" and @type="' +
                        selectedStage.getAttribute("type") + '"]');
                    if (xmlNode) {
                        stageFiles.select(xmlNode);
                    }
                }
            });
        };
        this.updateStatus();

        diffFiles.addEventListener("afterchoose", this.$afterchoose = function(e, update) {
            var node = this.selected || e.selected;
            if (!node || node.tagName != "file" || this.selection.length > 1 ||
                !ide.onLine && !ide.offlineFileSystemSupport) //ide.onLine can be removed after update apf
                    return;

            var staged = this.id == "stageFiles";

            var chunkIndices = function(chunks) {
                var res = _.reduce(chunks, function(acc, chunk) {
                    acc.indices.push({
                        start: acc.lineCount, length: chunk.lines.length + 1, file: fileName, staged: staged
                    });
                    acc.lineCount += chunk.lines.length + 1;

                    return acc;
                }, {indices: [], lineCount: 0});

                return res.indices;
            };

            var trimPath = function trimPath(dirtyPath) { // I'm not proud of all this
                var path = dirtyPath;
                if (path.indexOf("diff for staged ") == 0) {
                    path = path.substring(16);
                } else if (path.indexOf("diff for ") == 0) {
                    path = path.substring(9);
                }
                return path;
            };

            var fileName = trimPath(node.getAttribute("path"));

            if (node.getAttribute("status") == "changed") {
                var cmd = "git diff ";
                if (staged) {
                    cmd += "--cached ";
                }
                var path = trimPath(node.getAttribute("path"));

                gcc.send(cmd + path, function(output, parser) {
                    var noDiff = output.data === ""

                    if (noDiff) {
                        var session = require("ext/gitc/gitc").gitEditorVis.currentEditor.getSession();
                        session.setValue("no changes");
                        require("ext/gitc/gitc").gitEditorVis.updateLineNumbers();
                        return;
                    }

                    var result = parser.parseDiff(output.data, output.stream, true)[0];
                    var chunks = result.chunks;
                    var content = "";
                    for (var i = 0; i < chunks.length; ++i) {
                        content += chunks[i].header + "\n";
                        content += chunks[i].text + "\n";
                    }
                    var Range = require("ace/range").Range
                    var globalOffset = 0;
                    var ranges = _.flatten(_.map(chunks, function(chunk) {
                        var localOffset = chunk.header.match("\\+[0-9]+");
                        var lineRange = function lineRange(no) {
                            return new Range(no, 0, no, 10);
                        };
                        globalOffset += 1; // chunk header
                        localOffset -= 1;
                        var result = [["context", lineRange(globalOffset)]].concat(_.map(chunk.lines, function(line) {
                            var no;
                            if (line.status === "deleted") {
                                no = line.number_new - localOffset + globalOffset;
                                localOffset -= 1;
                            } else {
                                no = line.number_new - localOffset + globalOffset;
                            }
                            return [line.status, lineRange(no - 1)];
                        }));
                        globalOffset += chunk.text.split("\n").length;

                        return result;
                    }), true /* flatten only one level */);

                    //force that gutter number has at least 4-piece
                    //this will display shifted gutter for >4-piece :(
                    var getGutterNumber = function(nr) {
                        if(!nr ) {
                            return "<span style='color:#E8E8E8'>----</span>";
                        }
                        if (nr.toString().length < 4) {
                            var offset = 4 - nr.toString().length;
                            var offsetString = "<span style='color:#E8E8E8'>";
                            for(var i = 0; i < offset; i++) {
                                offsetString += "-";
                            }
                            offsetString += "</span>";
                            nr = offsetString + nr;
                        }
                        return nr;
                    };

                    var getGutterLines = function(left, right) {
                        left = getGutterNumber(left);
                        right = getGutterNumber(right);
                        return "<div style='width:100%'>" +
                               "<div style='width:50%;text-align:center;position:relative;display:inline;'>" +
                                        left + " </div>" +
                               "<div style='width:50%;text-align:center;position:relative;display:inline;border-left:1px solid black'>" +
                                        right + "</div>" +
                               "</div>"
                    };

                    var lines = _.flatten(_.map(chunks, function(chunk) {
                        return ["<div style='text-align:center'>---</div>"].concat(_.map(chunk.lines, function(line) {
                            if (line.status === "deleted") {
                                return getGutterLines(line.number_old, "");
                            } else if (line.status === "added") {
                                return getGutterLines("", line.number_new);
                            } else {
                                return getGutterLines(line.number_old, line.number_new);
                            }
                        }));
                    }), true /* flatten only one level */);

                    _self.showDiff(fileName, content, ranges, lines, "changed", chunkIndices(chunks), update);
                });
            } else if (node.getAttribute("status") == "added") {
                var Range = require("ace/range").Range;
                gcc.send("cat " + trimPath(node.getAttribute("path")), function(output) {
                    var lines = output.data.split("\n");
                    var ranges = [["added", new Range(0, 0, lines.length, 10)]];
                    for (var i = 0; i < lines.length; ++i) {
                        lines[i] = "+" + lines[i];
                    }
                    _self.showDiff(fileName, lines.join("\n"), ranges, "added", undefined, []);
                });
            } else if (node.getAttribute("status") == "removed") {
                var Range = require("ace/range").Range;
                gcc.send("git show HEAD:" + trimPath(node.getAttribute("path")), function(output) {
                    var lines = output.data.split("\n");
                    var ranges = [["deleted", new Range(0, 0, lines.length, 10)]];
                    for (var i = 0; i < lines.length; ++i) {
                        lines[i] = "-" + lines[i];
                    }
                    _self.showDiff(fileName, lines.join("\n"), ranges, "removed", undefined, []);
                });
            }
        });

        stageFiles.addEventListener("afterchoose", this.$afterchoose);
    },

    stage : function(chunk) {
        var gcc = require("ext/gitc/gitc").gitcCommands;
        var self = this;
        gcc.send("gitc_stage " + chunk.file + " " + chunk.start + " " + chunk.length, function(output, parser) {
            var afterChoose = self.$afterchoose.bind(self.getWorkingDirTree());
            self.refresh();
            afterChoose({}, true); // update editor
        });
    },

    unstage : function(chunk) {
        var gcc = require("ext/gitc/gitc").gitcCommands;
        var self = this;
        gcc.send("gitc_unstage " + chunk.file + " " + chunk.start + " " + chunk.length, function(output, parser) {
            var afterChoose = self.$afterchoose.bind(self.getStageTree());
            self.refresh();
            afterChoose({}, true); // update editor
        });
    },

    discard : function(chunk) {
        var gcc = require("ext/gitc/gitc").gitcCommands;
        var self = this;
        gcc.send("gitc_discard " + chunk.file + " " + chunk.start + " " + chunk.length, function(output, parser) {
            var afterChoose = self.$afterchoose.bind(self.getWorkingDirTree());
            self.refresh();
            afterChoose({}, true); // update editor
        });
    },

    stageSelectedFile: function() {
        var gcc = require("ext/gitc/gitc").gitcCommands;
        var selected = diffFiles.selected;
        var path = selected.getAttribute("path");
        var self = this;

        gcc.send("git add " + path, function(output, parser) {
            if (output.data == "") { // staged successfully
                self.refresh();
            } else {
                alert(output.data);
            }
        });
    },

    unstageSelectedFile: function() {
        var gcc = require("ext/gitc/gitc").gitcCommands;
        var selected = stageFiles.selected;
        var path = selected.getAttribute("path");
        var self = this;

        gcc.send("git reset " + path, function(output, parser) {
            if (output.stream != "stderr") { // unstaged successfully
                self.refresh();
            } else {
                alert(output.data);
            }
        });
    },

    discardSelectedFile: function() {
        var gcc = require("ext/gitc/gitc").gitcCommands;
        var selected = diffFiles.selected;
        var path = selected.getAttribute("path");
        var self = this;

        gcc.send("git checkout " + path, function(output, parser) {
            if (output.stream != "stderr") { // discarded successfully
                self.refresh();
            } else {
                alert(output.data);
            }
        });
    },

    pull: function() {
        var gcc = require("ext/gitc/gitc").gitcCommands;
        var self = this;

        gcc.send("git pull", function(output) {
            if (output.stream != "stderr") {
                self.refresh();
            } else {
                alert(output.data);
            }
        });
    },

    push: function() {
        var gcc = require("ext/gitc/gitc").gitcCommands;
        var self = this;

        gcc.send("git push", function(output) {
            if (output.stream != "stderr") {
                alert("Changes pushed.");
            } else {
                alert(output.data);
            }
        });
    },

    init : function() {
        var _self = this;

        // Set the panel var for the panels extension
        this.panel = winDiffView;
        this.nodes.push(winDiffView);

        this.getCommitButton().addEventListener("click", function(e) {
            if (e.currentTarget.id == "commit-button") {
                var text = _self.getCommitMessageTextField();
                var msg = text.getValue();

                // @TODO multi line commit messages? Also: proper dialogs instead of alerts
                if (msg.trim() == "") {
                    alert("Please provide a commit message.");
                } else {
                    // commit
                    var gcc = require("ext/gitc/gitc").gitcCommands;
                    gcc.send("git commit -m \"" + msg + "\"", function(output, parser) {
                        if (output.data.indexOf("no changes added to commit") != -1) {
                            alert("Nothing to commit.");
                        } else {
                            alert(output.data);
                            text.setValue("");
                            _self.refresh();
                        }
                    });
                }
            }
        });

        ide.addEventListener("afteroffline", function(){
            diffFiles.selectable = false;
            stageFiles.selectable = false;
            //_self.button.enable();
        })
        
        ide.addEventListener("afteronline", function(){
            diffFiles.selectable = true;
            stageFiles.selectable = true;
        })

        var onFocus = function onFocus() {
            var beReady = function beReady() {
                if (!_self.ready) {
                    if (_self.getTree().getModel()) {
                        _self.onReady();
                    } else {
                        setTimeout(beReady, 100);
                    }
                }
            };
            beReady();
        };
        _self.getTree().addEventListener("focus", onFocus);
    },

    /**
     * Called when the user hits the refresh button in the Project Files header
     */
    refresh : function() {
        this.updateStatus();
    },

    $cancelWhenOffline : function() {
        if (!ide.onLine && !ide.offlineFileSystemSupport)
            return false;
    },

    getWorkingDirTree: function(module) {
        module = module || this;
        return module.panel.childNodes[3].childNodes[1];
    },

    getStageTree: function(module) {
        module = module || this;
        return module.panel.childNodes[3].childNodes[3];
    },

    getTree: function(module) {
        return this.getWorkingDirTree(module);
    },

    getCommitMessageTextField: function() {
        return this.panel.childNodes[3].childNodes[5];
    },

    getCommitButton: function() {
        return this.panel.childNodes[3].childNodes[6];
    },

    moveFile : function(path, newpath){
        davProject.move(path, newpath);
        diffFiles.enable();
        diffFiles.focus();
    },
    
    show : function(e) {
        if (!this.panel || !this.panel.visible) {
            this.ready = false;
            panels.activate(this);
            this.enable();
        }
        else {
            panels.deactivate(null, true);
        }
        
        return false;
    },

    enable : function(){
        this.nodes.each(function(item){
            item.enable();
        });
    },

    disable : function(){
        this.nodes.each(function(item){
            item.disable();
        });
    },

    destroy : function(){
        commands.removeCommandByName("opengitcpanel");
        
        this.nodes.each(function(item){
            item.destroy(true, true);
        });
        this.nodes = [];

        panels.unregister(this);
    }
});

});
