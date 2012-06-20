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
    },

    /**
     * Creates a model usable by the tree from the given file paths.
     */
    createModel: function createFileModel(rootName, files) {
        var folders = _.groupBy(files, function(file) {
            return _.reduce(_.initial(file.path.split("/")), function(a, b) { return a + "/" + b });
        });
        return "<data><folder type='folder' name='" + rootName + "' path='/workspace/' root='1'>" +
            _.map(Object.keys(folders).sort(), function(folder) {
                var children = undefined;
                if (folders[folder].length == 1 && folders[folder][0].path.match(".*/$")) { // it's a folder not added yet
                    children = "";
                } else {
                    children = _.map(folders[folder], function(file) {
                        return "<file type='file' path='" + file.path + "' name='" +
                            file.path.substring(file.path.lastIndexOf("/") + 1) + "' status='" + file.status + "' />";
                    }).join("")
                }
                return "<folder type='folder' path='" + folder + "' name='" +
                    folder.substring(folder.lastIndexOf("/") + 1) + "'>" +
                    children + "</folder>";
            }).join("") +
            "</folder></data>";
    },

    onReady : function() {
        var _self = this;

        require("ext/gitc/gitc").gitcCommands.send("status -s", function(out, stream, parser) {
            var st = parser.parseShortStatus(out, stream);
            var model = _self.createModel("Working Directory", st.working_dir.getAll());

            diffFiles.getModel().load(model);
            if (this.loadedSettings === 1) {
                var parentNode = diffFiles.queryNode("folder[@root=1]");

                diffFiles.$setLoadStatus(parentNode, "loaded");
                diffFiles.slideToggle(apf.xmldb.getHtmlNode(parentNode, diffFiles), 1, true, null, null);
            }
            _self.ready = true;
        });
    },

    init : function() {
        var _self = this;

        // Set the panel var for the panels extension
        this.panel = winDiffView;
        this.nodes.push(winDiffView);

        ide.addEventListener("afteroffline", function(){
            diffFiles.selectable = false;
            //_self.button.enable();
        })
        
        ide.addEventListener("afteronline", function(){
            diffFiles.selectable = true;
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

    getTree: function(module) {
        module = module || this;
        return module.panel.childNodes[3].childNodes[1];
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
