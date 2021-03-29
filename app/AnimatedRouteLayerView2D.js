/**
 *
 * AnimatedRouteLayerView2D
 *  - Animated Route LayerView 2D
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  1/21/2021 - 0.0.1 -
 * Modified:
 *
 */
define([
  "esri/core/watchUtils",
  "addons/audubon",
  "esri/views/2d/layers/BaseLayerViewGL2D"
], function(watchUtils, audubon, BaseLayerViewGL2D){

  const AnimatedRouteLayerView2D = BaseLayerViewGL2D.createSubclass({
    declaredClass: "AnimatedRouteLayerView2D",

    _audubon: null,

    properties: {
      renderer: {
        aliasOf: 'layer.renderer'
      },
      progress: {
        type: Number
      },
      progressConversionFactor: {
        aliasOf: 'layer.progressConversionFactor'
      },
      polylineInfos: {
        type: Array.of(Object)
      },
      selection: {
        type: Array.of(Number)
      }
    },

    /**
     *
     */
    constructor: function(){
      this.progress = 0;
      this.polylineInfos = [];
      this.selection = [];
    },

    /**
     *
     */
    attach: function(){

      this._audubon = new audubon.Audubon(this.context);

      watchUtils.whenDefinedOnce(this.layer, 'sources', sources => {
        // IMAGE ASSETS //
        const imageAssets = this.layer.renderer.getImageAssets();

        this.polylineInfos = [];

        sources.forEach((source) => {

          const marker = this._audubon.createMarker(imageAssets);
          marker.id = source.id;

          const polyline = this._audubon.createPolyline(source.geometry);
          polyline.id = source.id;

          //console.info(polyline.id, polyline.timeExtent.start, polyline.timeExtent.end, (polyline.timeExtent.end - polyline.timeExtent.start));

          this.polylineInfos.push({ id: source.id, polyline: polyline, marker: marker });
        });
        this.initializeRenderer();
      });

      // IDENTIFY //
      let viewClickHandle = null;
      watchUtils.init(this.layer, 'identifyEnabled', identifyEnabled => {
        if(identifyEnabled){
          viewClickHandle = this.view.on('click', this.identify.bind(this));
        } else {
          viewClickHandle && viewClickHandle.remove();
        }
      });

      const layerStartDateValue = (this.layer.startDate.valueOf());

      // TIME EXTENT CHANGE //
      this.view.watch('timeExtent', timeExtent => {
        // MILLISECONDS TO SECONDS //
        this.progress = timeExtent ? ((timeExtent.start.valueOf() - layerStartDateValue) / this.progressConversionFactor) : 0;
        //console.info('PROGRESS: ', this.progress)
        this.requestRender();
      });

    },

    /**
     *
     */
    detach: function(){ },

    /**
     *
     */
    initializeRenderer: function(){
      this.polylineInfos.forEach(polylineInfo => {
        this.renderer.initInfo('default', polylineInfo);
      });
    },

    _updateRenderer: function(polylineInfo){

      if(polylineInfo.polyline.isWithinTimeExtent(this.progress)){
        this.renderer.updateInfo('moving', polylineInfo);
      } else {
        this.renderer.updateInfo('default', polylineInfo);
      }

      if(this.selection.includes(polylineInfo.id)){
        this.renderer.setSelected(polylineInfo);
      }

    },

    /*updateRenderer: function(){
      this.polylineInfos.forEach(polylineInfo => {
        this._updateRenderer(polylineInfo);
      });
    },*/

    /**
     *
     * @param clickEvt
     */
    identify: function(clickEvt){
      clickEvt.preventDefault();

      const marker = this._audubon.hitTest(clickEvt.x, clickEvt.y);
      if(marker){
        this.selection.push(marker.id);
      } else {
        this.selection.length = 0;
      }
      this.requestRender();

    },

    /**
     *
     * @param renderParams
     */
    render: function(renderParams){

      this.polylineInfos.forEach(polylineInfo => {

        // MARKER //
        const pos = polylineInfo.polyline.getPositionAtTime(this.progress);
        polylineInfo.marker.position = pos.coords;
        polylineInfo.marker.angle = pos.angle;

        // POLYLINE //
        polylineInfo.polyline.progress = this.progress;
                
        this._updateRenderer(polylineInfo);
      });

      this._audubon.render(this, renderParams);

    }

  });
  AnimatedRouteLayerView2D.version = "0.0.1";

  return AnimatedRouteLayerView2D;
});
