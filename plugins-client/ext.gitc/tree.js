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

        ide.addEventListener("afteropenfile", function(e) {
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

        tabEditors.addEventListener("afterswitch", function(e) {
            var doc = e.nextPage.$doc;
            require("ext/gitc/gitc").gitEditorVis.updateLineNumbers(doc.lines);
        });
    },

    showDiff: function showDiff(title, diff, ranges, lines) {
        var node = apf.getXml('<file newfile="1" type="file" size="" changed="1" '
                + 'name="' + title + ' diff" path="diff for ' + title + '" contenttype="text/plain; charset=utf-8" '
                + 'modifieddate="" creationdate="" lockable="false" hidden="false" '
                + 'executable="false"></file>');
        var doc = ide.createDocument(node);
        doc.setValue(diff);
        doc.type = "diff";
        doc.ranges = ranges;
        doc.lines = lines;
        ide.dispatchEvent("openfile", {doc: doc, type: "newfile"});

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
            node.files.push(value);
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
            xml += ">";
            var keys = Object.keys(folder.folders);
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

        require("ext/gitc/gitc").gitcCommands.send("git status -s", function(output, parser) {
            var st = parser.parseShortStatus(output.data, output.stream);
            var workingDirModel = _self.createModel("Working Directory", st.working_dir.getAll());
            var stageModel = _self.createModel("Stage", st.staging_area.getAll());

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
        });

        diffFiles.addEventListener("afterchoose", this.$afterchoose = function() {
            var node = this.selected;
            if (!node || node.tagName != "file" || this.selection.length > 1 ||
                !ide.onLine && !ide.offlineFileSystemSupport) //ide.onLine can be removed after update apf
                    return;

            if (node.getAttribute("status") == "changed") {
                gcc.send("git diff " + node.getAttribute("path"), function(output, parser) {
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
                                        left + "</div>" +
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

                    _self.showDiff(node.getAttribute("path"), content, ranges, lines);
                });
            } else if (node.getAttribute("status") == "added") {
                var Range = require("ace/range").Range;
                gcc.send("cat " + node.getAttribute("path"), function(output) {
                    var lines = output.data.split("\n");
                    var ranges = [["added", new Range(0, 0, lines.length, 10)]];
                    for (var i = 0; i < lines.length; ++i) {
                        lines[i] = "+" + lines[i];
                    }
                    _self.showDiff(node.getAttribute("path"), lines.join("\n"), ranges);
                });
            } else if (node.getAttribute("status") == "removed") {
                var Range = require("ace/range").Range;
                gcc.send("git show HEAD:" + node.getAttribute("path"), function(output) {
                    var lines = output.data.split("\n");
                    var ranges = [["deleted", new Range(0, 0, lines.length, 10)]];
                    for (var i = 0; i < lines.length; ++i) {
                        lines[i] = "-" + lines[i];
                    }
                    _self.showDiff(node.getAttribute("path"), lines.join("\n"), ranges);
                });
            }
        });
    },

    init : function() {
        var _self = this;

        // Set the panel var for the panels extension
        this.panel = winDiffView;
        this.nodes.push(winDiffView);

        ide.addEventListener("afteroffline", function(){
            diffFiles.selectable = false;
            stageFiles.selectable = false;
            //_self.button.enable();
        })
        
        ide.addEventListener("afteronline", function(){
            diffFiles.selectable = true;
            stageFiles.selectable = true;
        })

        // This adds a "Show Hidden Files" item to the settings dropdown
        // from the Project Files header
        mnuGitcSettings.appendChild(new apf.item({
            id      : "mnuitemHiddenFiles",
            type    : "check",
            caption : "Show Hidden Files",
            visible : "{diffFiles.visible}",
            checked : "[{require('core/settings').model}::auto/difftree/@showhidden]",
            onclick : function(e){
                setTimeout(function() {
                    _self.changed = true;
                    settings.save();
                    
                    (davProject.realWebdav || davProject)
                        .setAttribute("showhidden", e.currentTarget.checked);

                    _self.refresh();
                });
            }
        }));

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
        return module.panel.childNodes[3].childNodes[4];
    },

    getTree: function(module) {
        return this.getWorkingDirTree(module);
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
