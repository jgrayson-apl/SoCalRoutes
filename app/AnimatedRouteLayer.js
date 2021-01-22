/**
 *
 * AnimatedRouteLayer
 *  - Animated Route Layer
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  1/20/2021 - 0.0.1 -
 * Modified:
 *
 */
define([
  "esri/Color",
  "esri/core/Accessor",
  "esri/core/promiseUtils",
  "esri/layers/Layer",
  "esri/layers/FeatureLayer",
  "Application/AnimatedRouteRenderer",
  "Application/AnimatedRouteLayerView2D",
  "moment/moment"
], function(Color, Accessor, promiseUtils,
            Layer, FeatureLayer,
            AnimatedRouteRenderer, AnimatedRouteLayerView2D,
            moment){

  /*const RouteLocationRenderer = Accessor.createSubclass({
    declaredClass: "AnnualCycleIndividualsRenderer",

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
      invalidColor: {
        type: Color,
        set: function(value){
          this._set('invalidColor', new Color(value));
          this.invalidColorWGL = [
            (this.invalidColor.r / 255),
            (this.invalidColor.g / 255),
            (this.invalidColor.b / 255),
            this.invalidColor.a
          ];
        }
      },
      invalidColorWGL: {
        type: Array.of(Number)
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
  RouteLocationRenderer.version = "0.0.1";*/

  /*RouteLocationRenderer.default = new RouteLocationRenderer({
    type: 'circle',
    color: '#d9832e',
    size: 15,
    invalidColor: '#cccccc',
    invalidSize: 4,
    lineColor: '#ffff00',
    lineWidth: 5,
    cutoffTime: (1000 * 60 * 3),  // 3 minutes //
    opacityAtCutoff: 0.1
  });*/


  const AnimatedRouteLayer = Layer.createSubclass({
    declaredClass: "AnimatedRouteLayer",

    properties: {
      trackIdField: {
        type: String
      },
      startDateField: {
        type: String
      },
      sourceLayer: {
        type: FeatureLayer,
        set: function(value){
          this._set('sourceLayer', value);
          this.initializeSources();
        }
      },
      sources: {
        type: Map
      },
      renderer: {
        type: AnimatedRouteRenderer
      },
      identifyEnabled: {
        type: Boolean,
        value: false
      }
    },
    /**
     *
     */
    constructor: function(){

      const defaultSymbol = {
        type: 'circle',
        cutoffTime: (1000 * 60 * 3),  // 3 minutes //
        opacityAtCutoff: 0.1,
        color: '#cccccc',
        size: 5,
        lineColor: '#dddddd',
        lineWidth: 3
      };

      this.renderer = new AnimatedRouteRenderer();
      this.renderer.registerAsset('circle', 'https://esri-audubon.s3-us-west-1.amazonaws.com/v1/apps/assets/textures/full-circle.png');
      this.renderer.registerAsset('bird', 'https://esri-audubon.s3-us-west-1.amazonaws.com/v1/apps/assets/textures/full-circle.png');
      this.renderer.setSymbol('default', {
        ...defaultSymbol
      });
      this.renderer.setSymbol('moving', {
        ...defaultSymbol,
        color: '#d9832e',
        size: 15,
        lineColor: '#ffff00',
        lineWidth: 5,
      });
    },

    /**
     *
     * @param sourceLayer
     * @returns {Promise}
     */
    getSourcesFeatures: function(sourceLayer){
      return promiseUtils.create((resolve, reject) => {
        const allFeaturesQuery = sourceLayer.createQuery();
        allFeaturesQuery.set({
          where: `1=1`,
          outFields: [this.trackIdField, this.startDateField],
          orderByFields: [`${this.trackIdField} ASC`, `${this.startDateField} ASC`],
          maxRecordCountFactor: 5,
          returnM: true
        });
        sourceLayer.queryFeatures(allFeaturesQuery).then(allFeaturesFS => {
          resolve({ features: allFeaturesFS.features });
        }).catch(reject);
      });
    },

    /**
     *
     */
    initializeSources: function(){

      const MINUTES_TO_MILLISECONDS = (60 * 1000);

      const alongToDateValue = (startTimeMoment, alongMinutes) => {
        return startTimeMoment.clone().add((alongMinutes * MINUTES_TO_MILLISECONDS), 'milliseconds').toDate().valueOf();
      };

      // GET SOURCE FEATURES //
      this.getSourcesFeatures(this.sourceLayer).then(({ features }) => {

        // SOURCE BY ID //
        const sourcesByID = features.reduce((list, feature) => {

          // SOURCE ID //
          const sourceId = feature.attributes[this.trackIdField];
          const startTimeMoment = moment.utc(feature.attributes[this.startDateField]);

          // GET ALL COORDINATES //
          const coordinates = feature.geometry.paths.reduce((geomCoords, path) => {
            const pathCoords = path.map(coords => {
              if(coords.length > 2){
                coords[2] = alongToDateValue(startTimeMoment, coords[2]);
              } else {
                coords[2] = 0.0;
              }
              return coords;
            });
            return geomCoords.concat(pathCoords);
          }, []);

          // FIND INFO FOR THIS SOURCE //
          let sourceInfo = list.get(sourceId);
          if(sourceInfo){
            sourceInfo.geometry = sourceInfo.geometry.concat(coordinates);
          } else {
            sourceInfo = { id: sourceId, geometry: coordinates };
          }

          return list.set(sourceId, sourceInfo);
        }, new Map());

        // SORT COORDS BY TIME //
        sourcesByID.forEach((sourcesInfo) => {
          sourcesInfo.geometry = sourcesInfo.geometry.sort((a, b) => {
            return (a[2] - b[2]);
          });
        });

        // SET SOURCES //
        this.sources = sourcesByID;

      });
    },

    /**
     *
     * @param view
     * @returns {AnimatedRouteLayerView2D}
     */
    createLayerView: function(view){
      if(view.type === "2d"){
        return new AnimatedRouteLayerView2D({ view: view, layer: this });
      }
    }

  });
  AnimatedRouteLayer.version = "0.0.1";

  return AnimatedRouteLayer;
});
