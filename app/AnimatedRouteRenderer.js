/**
 *
 * AnimatedRouteRenderer
 *  - Animated Route Renderer
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  1/22/2021 - 0.0.1 -
 * Modified:
 *
 */
define([
  "esri/core/Accessor",
  "esri/Color"
], function(Accessor, Color){


  const AnimatedRouteSymbol = Accessor.createSubclass({
    declaredClass: "AnimatedRouteSymbol",

    properties: {
      type: {
        type: String
      },
      cutoffTime: {
        type: Number
      },
      opacityAtCutoff: {
        type: Number
      },
      color: {
        type: Color,
        set: function(value){
          this._set('color', new Color(value));
          this.colorWGL = [
            (this.color.r / 255),
            (this.color.g / 255),
            (this.color.b / 255),
            this.color.a
          ];
        }
      },
      colorWGL: {
        type: Array.of(Number)
      },
      size: {
        type: Number
      },
      lineColor: {
        type: Color,
        set: function(value){
          this._set('lineColor', new Color(value));
          this.lineColorWGL = [
            (this.lineColor.r / 255),
            (this.lineColor.g / 255),
            (this.lineColor.b / 255),
            this.lineColor.a
          ];
        }
      },
      lineColorWGL: {
        type: Array.of(Number)
      },
      lineWidth: {
        type: Number
      }
    }
  });
  AnimatedRouteSymbol.version = "0.0.1";


  const AnimatedRouteRenderer = Accessor.createSubclass({
    declaredClass: "AnimatedRouteRenderer",

    properties: {
      assetInfos: {
        type: Map
      },
      symbols: {
        type: Map
      },
      selectionColor: {
        type: Color,
        set: function(value){
          this._set('selectionColor', new Color(value));
          this._selectionColorWGL = [
            (this.selectionColor.r / 255),
            (this.selectionColor.g / 255),
            (this.selectionColor.b / 255),
            this.selectionColor.a
          ];
        }
      },
      _selectionColorWGL: {
        type: Array.of(Number)
      },
    },

    constructor: function(){
      this.assetInfos = new Map();
      this.symbols = new Map();
      this.selectionColor = 'cyan';
    },
    registerAssets: function(assets){
      assets.forEach(asset => {
        this.assetInfos.set(asset[0], { imageIndex: this.assetInfos.size, url: asset[1] });
      });
    },
    getImageAssets: function(){
      return Array.from(this.assetInfos.values()).map(assetInfo => assetInfo.url);
    },
    setSymbol: function(symbolName, symbolOptions){
      this.symbols.set(symbolName, new AnimatedRouteSymbol(symbolOptions));
    },
    initInfo: function(symbolName, polylineInfo){
      const symbol = this.symbols.get(symbolName);
      if(symbol){
        polylineInfo.marker.imageIndex = this.assetInfos.get(symbol.type).imageIndex;
        polylineInfo.polyline.cutoffTime = symbol.cutoffTime;
        polylineInfo.polyline.opacityAtCutoff = symbol.opacityAtCutoff;
        this._update(symbol, polylineInfo);
      }
    },
    setSelected: function(polylineInfo){
      polylineInfo.marker.color = this._selectionColorWGL;
      polylineInfo.polyline.color = this._selectionColorWGL;
    },
    updateInfo: function(symbolName, polylineInfo){
      const symbol = this.symbols.get(symbolName);
      if(symbol){
        this._update(symbol, polylineInfo);
      }
    },
    _update: function(symbol, polylineInfo){
      polylineInfo.marker.imageIndex = this.assetInfos.get(symbol.type).imageIndex;
      polylineInfo.marker.size = symbol.size;
      polylineInfo.marker.color = symbol.colorWGL;
      polylineInfo.polyline.width = symbol.lineWidth;
      polylineInfo.polyline.color = symbol.lineColorWGL;
    }

  });
  AnimatedRouteRenderer.version = "0.0.1";

  return AnimatedRouteRenderer;
});
