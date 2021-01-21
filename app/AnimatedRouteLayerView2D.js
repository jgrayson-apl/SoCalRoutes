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
], function(watchUtils, audubon, BaseLayerViewGL2D ){

  const AnimatedRouteLayerView2D = BaseLayerViewGL2D.createSubclass({
    declaredClass: "AnimatedRouteLayerView2D",

    _audubon: null,

    properties: {
      assetInfos: {
        type: Object,
        value: {
          'bird': {
            imageIndex: 0,
            url: 'https://esri-audubon.s3-us-west-1.amazonaws.com/v1/apps/assets/textures/osprey.png',
            //url: 'textures/osprey-no-outline.png',
            flap: true
          },
          'circle': {
            imageIndex: 1,
            url: 'https://esri-audubon.s3-us-west-1.amazonaws.com/v1/apps/assets/textures/full-circle.png',
            //url: 'textures/full-circle.png',
            flap: false
          }
        }
      },
      polylineInfos: {
        type: Array.of(Object)
      }
    },

    /**
     *
     */
    constructor: function(){
      this.polylineInfos = [];
    },

    /**
     *
     */
    attach: function(){

      this._audubon = new audubon.Audubon(this.context);

      watchUtils.whenDefinedOnce(this.layer, 'sources', sources => {
        sources.forEach((source) => {

          const marker = this._audubon.createMarker([this.assetInfos.bird.url, this.assetInfos.circle.url]);
          marker.id = source.id;

          const polyline = this._audubon.createPolyline(source.geometry);
          polyline.id = source.id;

          this.polylineInfos.push({ id: source.id, polyline: polyline, marker: marker });

        });
        this.updateRenderer();
      });

      // this.layer.watch('renderer', renderer => {
      //   this.updateRenderer();
      //   this.requestRender();
      // });

      let viewClickHandle = null;
      watchUtils.init(this.layer, 'identifyEnabled', identifyEnabled => {
        if(identifyEnabled){
          viewClickHandle = this.view.on('click', this.identify.bind(this));
        } else {
          viewClickHandle && viewClickHandle.remove();
        }
      });

      this.view.watch('timeExtent', timeExtent => {
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
    updateRenderer: function(){

      const renderer = this.layer.renderer;
      const assetInfo = this.assetInfos[renderer.birdSymbolType];

      this.polylineInfos.forEach(polylineInfo => {

        polylineInfo.polyline.width = renderer.lineWidth;
        polylineInfo.polyline.color = renderer.lineColorWGL;
        polylineInfo.polyline.cutoffTime = renderer.cutoffTime;
        polylineInfo.polyline.opacityAtCutoff = renderer.opacityAtCutoff;

        polylineInfo.marker.imageIndex = assetInfo.imageIndex;
        polylineInfo.marker.flap = assetInfo.flap;
        polylineInfo.marker.size = renderer.birdSize;
        polylineInfo.marker.color = renderer.birdColorWGL;

      });

    },

    /**
     *
     * @param renderParams
     */
    render: function(renderParams){

      // WEEK //
      const progress = this.view.timeExtent ? this.view.timeExtent.start.valueOf() : 0;

      this.polylineInfos.forEach(polylineInfo => {
        // POLYLINE //
        polylineInfo.polyline.progress = progress;
        // MARKER //
        const pos = polylineInfo.polyline.getPositionAtTime(progress);
        polylineInfo.marker.position = pos.coords;
        polylineInfo.marker.angle = pos.angle;
      });

      this._audubon.render(this, renderParams);

    },

    /**
     *
     * @param clickEvt
     */
    identify: function(clickEvt){
      clickEvt.preventDefault();

      const selectionColor = [0, 1, 0, 1];

      const marker = this._audubon.hitTest(clickEvt.x, clickEvt.y);
      if(marker){
        const renderer = this.layer.renderer;

        this.polylineInfos.forEach(polylineInfo => {
          if(marker && (marker.id === polylineInfo.id)){
            polylineInfo.marker.size = (renderer.birdSize * 2.0);
            polylineInfo.marker.color = selectionColor;
            polylineInfo.polyline.color = selectionColor;
          } else {
            polylineInfo.marker.size = renderer.birdSize;
            polylineInfo.marker.color = renderer.birdColorWGL;
            polylineInfo.polyline.color = renderer.lineColorWGL;
          }
        });

      } else {
        this.updateRenderer();
      }
    }

  });
  AnimatedRouteLayerView2D.version = "0.0.1";

  return AnimatedRouteLayerView2D;
});
