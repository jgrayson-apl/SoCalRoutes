/*
  Copyright 2020 Esri

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

define([
  "calcite",
  "dojo/_base/declare",
  "ApplicationBase/ApplicationBase",
  "dojo/i18n!./nls/resources",
  "ApplicationBase/support/itemUtils",
  "ApplicationBase/support/domHelper",
  "dojo/dom-construct",
  "esri/identity/IdentityManager",
  "esri/core/Evented",
  "esri/core/watchUtils",
  "esri/core/promiseUtils",
  "esri/portal/Portal",
  "esri/widgets/Home",
  "esri/widgets/Search",
  "esri/widgets/Legend",
  "esri/widgets/BasemapGallery",
  "esri/widgets/Expand",
  "esri/widgets/TimeSlider",
  "moment/moment",
  "Application/AnimatedRouteLayer"
], function(calcite, declare, ApplicationBase,
            i18n, itemUtils, domHelper, domConstruct,
            IdentityManager, Evented, watchUtils, promiseUtils, Portal,
            Home, Search, Legend, BasemapGallery, Expand,
            TimeSlider, moment, AnimatedRouteLayer){

  return declare([Evented], {

    /**
     *
     */
    constructor: function(){
      // BASE //
      this.base = null;
      // CALCITE WEB //
      calcite.init();
    },

    /**
     *
     * @param base
     */
    init: function(base){
      if(!base){
        console.error("ApplicationBase is not defined");
        return;
      }
      this.base = base;

      const webMapItems = this.base.results.webMapItems;
      const webSceneItems = this.base.results.webSceneItems;
      const validItems = webMapItems.concat(webSceneItems);
      const firstItem = (validItems && validItems.length) ? validItems[0].value : null;
      if(!firstItem){
        console.error("Could not load an item to display");
        return;
      }

      // TITLE //
      this.base.config.title = (this.base.config.title || itemUtils.getItemTitle(firstItem));
      domHelper.setPageTitle(this.base.config.title);
      document.querySelectorAll('.app-title').forEach(node => node.innerHTML = this.base.config.title);
      // DESCRIPTION //
      if(firstItem.description && firstItem.description.length){
        document.querySelectorAll('.app-description').forEach(node => node.innerHTML = firstItem.description);
      }

      const viewProperties = itemUtils.getConfigViewProperties(this.base.config);
      viewProperties.container = "view-node";
      viewProperties.constraints = { snapToZoom: false };

      const portalItem = this.base.results.applicationItem.value;
      const appProxies = (portalItem && portalItem.appProxies) ? portalItem.appProxies : null;

      itemUtils.createMapFromItem({ item: firstItem, appProxies: appProxies }).then(map => {
        viewProperties.map = map;
        itemUtils.createView(viewProperties).then(view => {
          view.when(() => {
            this.viewReady(firstItem, view).then(() => {
              view.container.classList.remove("loading");
            });
          });
        });
      });
    },

    /**
     *
     * @param item
     * @param view
     */
    viewReady: function(item, view){
      return promiseUtils.create((resolve, reject) => {

        // USER SIGN IN //
        this.initializeUserSignIn().catch(reject).then(() => {

          // STARTUP DIALOG //
          this.initializeStartupDialog();

          // VIEW LOADING //
          this.initializeViewLoading(view);

          // PLACES //
          this.initializeSceneSlides(view);

          // POPUP DOCKING OPTIONS //
          view.popup.dockEnabled = true;
          view.popup.dockOptions = {
            buttonEnabled: false,
            breakpoint: false,
            position: "top-center"
          };

          // SEARCH //
          const search = new Search({ view: view, searchTerm: this.base.config.search || "" });
          const searchExpand = new Expand({
            view: view,
            content: search,
            expanded: true,
            expandIconClass: "esri-icon-search",
            expandTooltip: "Search"
          });
          view.ui.add(searchExpand, { position: "top-right", index: 0 });

          // BASEMAPS //
          const basemapGalleryExpand = new Expand({
            view: view,
            content: new BasemapGallery({ view: view }),
            expandIconClass: "esri-icon-basemap",
            expandTooltip: "Basemap"
          });
          view.ui.add(basemapGalleryExpand, { position: "top-right", index: 1 });

          // HOME //
          const home = new Home({ view: view });
          view.ui.add(home, { position: "top-left", index: 0 });

          // APPLICATION READY //
          this.applicationReady(view).then(resolve).catch(reject);

        });
      });
    },

    /**
     *
     * @returns {*}
     */
    initializeUserSignIn: function(){

      const checkSignInStatus = () => {
        return IdentityManager.checkSignInStatus(this.base.portal.url).then(userSignIn).catch(userSignOut).then();
      };
      IdentityManager.on("credential-create", checkSignInStatus);

      // SIGN IN NODE //
      const signInNode = document.getElementById("sign-in-node");
      const userNode = document.getElementById("user-node");

      // UPDATE UI //
      const updateSignInUI = () => {
        if(this.base.portal.user){
          document.getElementById("user-firstname-node").innerHTML = this.base.portal.user.fullName.split(" ")[0];
          document.getElementById("user-fullname-node").innerHTML = this.base.portal.user.fullName;
          document.getElementById("username-node").innerHTML = this.base.portal.user.username;
          document.getElementById("user-thumb-node").src = this.base.portal.user.thumbnailUrl;
          signInNode.classList.add('hide');
          userNode.classList.remove('hide');
        } else {
          signInNode.classList.remove('hide');
          userNode.classList.add('hide');
        }
        return promiseUtils.resolve();
      };

      // SIGN IN //
      const userSignIn = () => {
        this.base.portal = new Portal({ url: this.base.config.portalUrl, authMode: "immediate" });
        return this.base.portal.load().then(() => {
          this.emit("portal-user-change", {});
          return updateSignInUI();
        }).catch(console.warn).then();
      };

      // SIGN OUT //
      const userSignOut = () => {
        IdentityManager.destroyCredentials();
        this.base.portal = new Portal({});
        return this.base.portal.load().then(() => {
          this.base.portal.user = null;
          this.emit("portal-user-change", {});
          return updateSignInUI();
        }).catch(console.warn).then();

      };

      // USER SIGN IN //
      signInNode.addEventListener("click", userSignIn);

      // SIGN OUT NODE //
      const signOutNode = document.getElementById("sign-out-node");
      if(signOutNode){
        signOutNode.addEventListener("click", userSignOut);
      }

      return checkSignInStatus();
    },

    /**
     *
     * @param view
     */
    initializeViewLoading: function(view){

      // LOADING //
      const updating_node = domConstruct.create("div", { className: "view-loading-node loader" });
      domConstruct.create("div", { className: "loader-bars" }, updating_node);
      domConstruct.create("div", { className: "loader-text font-size--3 text-white", innerHTML: "Updating..." }, updating_node);
      view.ui.add(updating_node, "bottom-right");
      watchUtils.init(view, "updating", (updating) => {
        updating_node.classList.toggle("is-active", updating);
      });

    },

    /**
     *
     */
    initializeStartupDialog: function(){

      // APP NAME //
      const pathParts = location.pathname.split('/');
      const appName = `show-startup-${pathParts[pathParts.length - 2]}`;

      // STARTUP DIALOG //
      const showStartup = localStorage.getItem(appName) || 'show';
      if(showStartup === 'show'){
        calcite.bus.emit('modal:open', { id: 'app-details-dialog' });
      }

      // HIDE STARTUP DIALOG //
      const hideStartupInput = document.getElementById('hide-startup-input');
      hideStartupInput.checked = (showStartup === 'hide');
      hideStartupInput.addEventListener('change', () => {
        localStorage.setItem(appName, hideStartupInput.checked ? 'hide' : 'show');
      });

    },

    /**
     *
     * @param view
     */
    initializeSceneSlides: function(view){

      if(view.map.presentation && view.map.presentation.slides && (view.map.presentation.slides.length > 0)){

        const slidesContainer = domConstruct.create("div", { className: 'slides-container animate-in-up' });
        view.ui.add(slidesContainer, { index: 0 });

        const slideLabel = domConstruct.create("div", { className: "slide-label icon-ui-up icon-ui-flush text-center font-size-1", title: 'toggle slides' }, slidesContainer);
        slideLabel.addEventListener('click', () => {
          slidesContainer.classList.toggle('animate-in-up');
          slidesContainer.classList.toggle('animate-out-up');
          slideLabel.classList.toggle('icon-ui-up');
          slideLabel.classList.toggle('icon-ui-down');
        });

        const slides = view.map.presentation.slides;
        slides.forEach(slide => {

          const slideBtn = domConstruct.create("button", { className: "slide-btn tooltip tooltip-top", 'aria-label': slide.title.text }, slidesContainer);
          domConstruct.create("img", { className: "slide-btn-thumb", src: slide.thumbnail.url }, slideBtn);

          slideBtn.addEventListener("click", clickEvt => {
            clickEvt.stopPropagation();
            //slide.applyTo(view);
            view.goTo({ target: slide.viewpoint }).then(() => { view.focus(); });
          });

        });
        /*view.on('layerview-create', (evt) => {
slides.forEach(slide => {
 if(!slide.visibleLayers.find(l => l.id === evt.layer.id)){
   slide.visibleLayers.push(evt.layer);
 }
});
});*/

      }

    },

    /**
     * APPLICATION READY
     *
     * @param view
     */
    applicationReady: function(view){
      return promiseUtils.create((resolve, reject) => {

        const sourceLocationsLayer = view.map.layers.find(layer => layer.title === "Medical Facilities");
        sourceLocationsLayer.visible = false;

        const routeLocationsLayer = view.map.layers.find(layer => layer.title === 'Route Locations');
        routeLocationsLayer.visible = false;

        // EndTimeUTC,Name,StartTimeUTC,Total_Kilometers,Total_Miles,Total_TravelTime,travelModeName,travelModeType,OBJECTID
        const routePathsLayer = view.map.layers.find(layer => layer.title === 'Route Paths');
        routePathsLayer.load().then(() => {
          routePathsLayer.visible = false;

          const animatedRoutesLayer = new AnimatedRouteLayer({
            title: `SoCal Routes`,
            trackIdField: routePathsLayer.objectIdField,
            startDateField: 'StartTimeUTC',
            identifyEnabled: true,
            sourceLayer: routePathsLayer
          });
          view.map.add(animatedRoutesLayer);


          // VIEW TIME SLIDER //
          this.timeSlider = new TimeSlider({
            container: 'time-slider-container',
            view: view
          });
          this.timeSlider.when(() => {

            const fullTimeExtent = routePathsLayer.timeInfo.fullTimeExtent;
            
            this.timeSlider.set({
              loop: true,
              timeVisible: true,
              playRate: 10,
              mode: "instant",
              fullTimeExtent: fullTimeExtent,
              values: [fullTimeExtent.start],
              stops: { interval: { value: 10, unit: "seconds" } }
            });

          });

          resolve();
        });
      });
    }

  });
});
