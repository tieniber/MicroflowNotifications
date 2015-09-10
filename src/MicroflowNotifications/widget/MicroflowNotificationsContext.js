/*jslint white:true, nomen: true, plusplus: true */
/*jshint browser: true */
/*global mx, define, require, browser, devel, console */
/*mendix */
/*
    MicroflowNotifications
    ========================

    @file      : MicroflowNotificationsContext.js
    @version   : 1.0
    @author    : Eric Tieniber
    @date      : 3/16/2015
    @copyright : 
    @license   : Apache 2

    Documentation
    ========================
    This widget periodically executes a microflow, and can display a notification if text is returned.
    Notifications are provided by the jQuery noty plugin
*/

// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
require({
    packages: [{ name: 'jquery', location: '../../widgets/MicroflowNotifications/lib', main: 'jquery-1.11.2.min' },
               { name: 'noty', location: '../../widgets/MicroflowNotifications/lib', main: 'jquery-noty-packaged-min' }]
}, [
    'dojo/_base/declare', 'mxui/widget/_WidgetBase',
    'mxui/dom', 'dojo/dom', 'dojo/query', 'dojo/dom-prop', 'dojo/dom-geometry', 'dojo/dom-class', 'dojo/dom-style', 'dojo/dom-construct', 'dojo/_base/array', 'dojo/_base/lang', 'dojo/text',
    'jquery', 'dojo/text!MicroflowNotifications/widget/template/MicroflowNotifications.html', 'noty'
], function (declare, _WidgetBase, dom, dojoDom, domQuery, domProp, domGeom, domClass, domStyle, domConstruct, dojoArray, lang, text, $, widgetTemplate, noty) {
    'use strict';
    
    // Declare widget's prototype.
    return declare('MicroflowNotifications.widget.MicroflowNotificationsContext', [ _WidgetBase ], {
        // _TemplatedMixin will create our dom node using this HTML template.
        //templateString: widgetTemplate,

        // Parameters configured in the Modeler.
		mf				:'',
		onclickmf		:'',
		interval		:0,
		layout			:'top',
		type			:'',
		timeout			:0,
		runstart		:false,
		buttons			:[],
		maxvisible		:1,

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handle: null,
        _contextObj: null,
        _objProperty: null,
		
		_intervalHandle:null,
		_notySingleton:null,
        // dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function () {
            this._objProperty = {};
        },

        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        postCreate: function () {
            console.log(this.id + '.postCreate');
            
			$.noty.defaults.maxVisible = this.maxvisible;
			
            this._setupEvents();
			
        },

        // mxui.widget._WidgetBase.update is called when context is changed or initialized. Implement to re-render and / or fetch data.
        update: function (obj, callback) {
            console.log(this.id + '.update');

            this._contextObj = obj;
            this._resetSubscriptions();
            this._updateRendering();
			
			//run the notification right away if the setting is on
			if (this.runstart) {
				this._refresh();
			}
			
            callback();
        },

        // mxui.widget._WidgetBase.enable is called when the widget should enable editing. Implement to enable editing if widget is input widget.
        enable: function () {

        },

        // mxui.widget._WidgetBase.enable is called when the widget should disable editing. Implement to disable editing if widget is input widget.
        disable: function () {

        },

        // mxui.widget._WidgetBase.resize is called when the page's layout is recalculated. Implement to do sizing calculations. Prefer using CSS instead.
        resize: function (box) {

        },

        // mxui.widget._WidgetBase.uninitialize is called when the widget is destroyed. Implement to do special tear-down work.
        uninitialize: function () {
            // Clean up listeners, helper objects, etc. There is no need to remove listeners added with this.connect / this.subscribe / this.own.
			clearInterval(this._intervalHandle);
		},
		
		_refresh: function () {
			var self = this,
			guid = null;
			
			function clearNotySingleton() {
				self._notySingleton = null;
			}
			
			if (this._contextObj) {
				guid = this._contextObj.getGuid();
			}
			mx.data.action({
				params: {
					applyto: 'selection',
					actionname: this.mf,
					guids: [guid]
				},
				callback: function (data) {
					var layout = self.layout,	//noty layout
					type = self.type,			//noty type
					timeout = self.timeout,		//noty timeout
					buttons = self.buttons,		//wdiget button config
					buttonArray = [],			//empty array for noty button config
					notyButtonFormat = {},		//a single item in the buttonArray
					buttonname,					//name of the button
					buttonmf,					//microflow name to be executed by the button
					buttonmffunction,			//function that will call the buttonmf microflow
					buttonclass,				//CSS class to be applied to the button
					i,							//iterator
					currentButton,				//current button in the loop
					guid = null;				//input parameter to the microflow
					
					if (self._contextObj) {
						guid = self._contextObj.getGuid();
					}
					
					function makeButtonFunction(bmf,guid) {
						return function(n) {
							var self = this;

							mx.data.action({
								params: {
									applyto: 'selection',
									actionname: bmf,
									guids: [guid]
								},
								callback: function (data) {},
								error: function (error) {
									console.log(this.id + ': An error occurred while executing button click microflow: ' + error.description);
								}	
							}, this);
							
							n.close();
						};
					}
					
					for(i =0; i<buttons.length; i++) {
						currentButton = buttons[i];
						buttonname = currentButton.buttonname;
						buttonmf = currentButton.buttonmf;
						buttonclass = currentButton.buttonclass;
						
						buttonmffunction = makeButtonFunction(buttonmf,guid);
						notyButtonFormat = {addClass: buttonclass, text: buttonname, onClick: buttonmffunction};
						buttonArray.push(notyButtonFormat);
					}

					if (timeout === 0) {
						timeout = false;
					}

					if (data !== null) {
						if (self.maxvisible === 1 && self._notySingleton !== null) {
							//close this noty so we can show another
							//unfortunately noty doesn't support updating its text on the fly
							self._notySingleton.close();
						} 
						if (buttons.length > 0) {
							//create with buttons, dismiss timer will not work
							self._notySingleton = window.noty({
								text: data,
								layout: layout,
								type: type,
								timeout: timeout,
								buttons: buttonArray,
								callback: {onClose: clearNotySingleton}
							});
						} else {
							//create without buttons, dismiss timer will work
							self._notySingleton = window.noty({
								text: data,
								layout: layout,
								type: type,
								timeout: timeout,
								callback: {onClose: clearNotySingleton}									
							});
						}					
					}
				},
				error: function (error) {
					console.log(this.id + ': An error occurred while executing refresh microflow: ' + error.description);
				}	
			}, this);
			
		},

        _setupEvents: function () {
			if (this.interval > 0) {
                this._intervalHandle = setInterval(lang.hitch(this, this._refresh), this.interval * 1000);
			}
        },

        _updateRendering: function () {
            //this.domNode.style.backgroundColor = this._contextObj ? this._contextObj.get(this.backgroundColor) : "";
        },

        _resetSubscriptions: function () {
            // Release handle on previous object, if any.
            if (this._handle) {
                this.unsubscribe(this._handle);
                this._handle = null;
            }

            if (this._contextObj) {
                this._handle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: this._updateRendering
                });
            }
        }
    });
});
