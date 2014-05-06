define(["jquery", "underscore", "js/views/baseview", "xblock/runtime.v1"],
    function ($, _, BaseView, XBlock) {

        var XBlockView = BaseView.extend({
            // takes XBlockInfo as a model

            initialize: function() {
                BaseView.prototype.initialize.call(this);
                this.view = this.options.view;
            },

            render: function(options) {
                var self = this,
                    view = this.view,
                    xblockInfo = this.model,
                    xblockUrl = xblockInfo.url();
                return $.ajax({
                    url: decodeURIComponent(xblockUrl) + "/" + view,
                    type: 'GET',
                    headers: { Accept: 'application/json' },
                    success: function(fragment) {
                        self.handleXBlockFragment(fragment, options);
                    }
                });
            },

            handleXBlockFragment: function(fragment, options) {
                var self = this,
                    wrapper = this.$el,
                    xblockElement,
                    success = options ? options.success : null,
                    xblock,
                    fragmentsRendered;

                fragmentsRendered = this.renderXBlockFragment(fragment, wrapper);
                fragmentsRendered.done(function() {
                    xblockElement = self.$('.xblock').first();
                    xblock = XBlock.initializeBlock(xblockElement);
                    self.xblock = xblock;
                    self.xblockReady(xblock);
                    if (success) {
                        success(xblock);
                    }
                });
            },

            /**
             * This method is called upon successful rendering of an xblock.
             */
            xblockReady: function(xblock) {
                // Do nothing
            },

            /**
             * Returns true if the specified xblock has children.
             */
            hasChildXBlocks: function() {
                return this.$('.wrapper-xblock').length > 0;
            },

            /**
             * Renders an xblock fragment into the specified element. The fragment has two attributes:
             *   html: the HTML to be rendered
             *   resources: any JavaScript or CSS resources that the HTML depends upon
             * Note that the XBlock is rendered asynchronously, and so a promise is returned that
             * represents this process.
             * @param fragment The fragment returned from the xblock_handler
             * @param element The element into which to render the fragment (defaults to this.$el)
             * @returns {*} A promise representing the rendering process
             */
            renderXBlockFragment: function(fragment, element) {
                var html = fragment.html,
                    resources = fragment.resources;
                if (!element) {
                    element = this.$el;
                }
                // First render the HTML as the scripts might depend upon it
                element.html(html);
                // Now asynchronously add the resources to the page
                return this.addXBlockFragmentResources(resources);
            },

            /**
             * Dynamically loads all of an XBlock's dependent resources. This is an asynchronous
             * process so a promise is returned.
             * @param resources The resources to be rendered
             * @returns {*} A promise representing the rendering process
             */
            addXBlockFragmentResources: function(resources) {
                var self = this,
                    applyResource,
                    numResources,
                    deferred;
                numResources = resources.length;
                deferred = $.Deferred();
                applyResource = function(index) {
                    var hash, resource, head, value, promise;
                    if (index >= numResources) {
                        deferred.resolve();
                        return;
                    }
                    value = resources[index];
                    hash = value[0];
                    if (!window.loadedXBlockResources) {
                        window.loadedXBlockResources = [];
                    }
                    if (_.indexOf(window.loadedXBlockResources, hash) < 0) {
                        resource = value[1];
                        promise = self.loadResource(resource);
                        window.loadedXBlockResources.push(hash);
                        promise.done(function() {
                            applyResource(index + 1);
                        }).fail(function() {
                            deferred.reject();
                        });
                    } else {
                        applyResource(index + 1);
                    }
                };
                applyResource(0);
                return deferred.promise();
            },

            /**
             * Loads the specified resource into the page.
             * @param resource The resource to be loaded.
             * @returns {*} A promise representing the loading of the resource.
             */
            loadResource: function(resource) {
                var head = $('head'),
                    mimetype = resource.mimetype,
                    kind = resource.kind,
                    placement = resource.placement,
                    data = resource.data;
                if (mimetype === "text/css") {
                    if (kind === "text") {
                        head.append("<style type='text/css'>" + data + "</style>");
                    } else if (kind === "url") {
                        head.append("<link rel='stylesheet' href='" + data + "' type='text/css'>");
                    }
                } else if (mimetype === "application/javascript") {
                    if (kind === "text") {
                        head.append("<script>" + data + "</script>");
                    } else if (kind === "url") {
                        // Return a promise for the script resolution
                        return $.getScript(data);
                    }
                } else if (mimetype === "text/html") {
                    if (placement === "head") {
                        head.append(data);
                    }
                }
                // Return an already resolved promise for synchronous updates
                return $.Deferred().resolve().promise();
            },

            /**
             * Creates a new child xblock instance based upon the supplied xblock info.
             * @param template The information about the desired template.
             * @param parent_locator
             * @returns {*} A promise representing the creation of the new xblock.
             */
            create: function(template, parent_locator) {
                var self = this,
                    operation = $.Deferred();
                template.parent_locator = parent_locator;
                $.postJSON(this.model.urlRoot, template,
                    function(data) {
                        var childLocator = data.locator,
                            xblockInfo = self.model;
                        xblockInfo.set('id', childLocator);
                        self.$el.data('locator', childLocator);
                        operation.resolve();
                    });
                return operation.promise();
            }
        });

        return XBlockView;
    }); // end define();
