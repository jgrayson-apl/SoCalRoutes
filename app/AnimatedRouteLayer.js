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
  "Application/AnimatedRouteLayerView2D",
  "moment/moment"
], function(Color, Accessor, promiseUtils,
            Layer, FeatureLayer, AnimatedRouteLayerView2D,
            moment){

  const RouteLocationRenderer = Accessor.createSubclass({
    declaredClass: "AnnualCycleIndividualsRenderer",

    properties: {
      birdSymbolType: {
        type: String
      },
      birdColor: {
        type: Color,
        set: function(value){
          this._set('birdColor', new Color(value));
          this.birdColorWGL = [
            (this.birdColor.r / 255),
            (this.birdColor.g / 255),
            (this.birdColor.b / 255),
            this.birdColor.a
          ];
        }
      },
      birdColorWGL: {
        type: Array.of(Number)
      },
      birdSize: {
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
      },
      cutoffTime: {
        type: Number
      },
      opacityAtCutoff: {
        type: Number
      }
    }
  });
  RouteLocationRenderer.version = "0.0.1";

  RouteLocationRenderer.default = new RouteLocationRenderer({
      birdSymbolType: 'circle',
      birdColor: '#d9832e',
      birdSize: 14,
      lineColor: '#ffffff',
      lineWidth: 8,
      cutoffTime: (1000 * 60 * 3),  // 3 minutes //
      opacityAtCutoff: 0.1
    });


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
        type: RouteLocationRenderer
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
      this.renderer = RouteLocationRenderer.default;
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
