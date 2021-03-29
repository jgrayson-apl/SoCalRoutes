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

  const DATE_CONVERSION_FACTORS = {
    MILLISECONDS_TO_SECONDS: 1000,
    SECONDS_TO_MINUTES: 60,
    MINUTES_TO_HOURS: 60,
    HOURS_TO_MINUTES: (1 / 60),
    MILLISECONDS_TO_MINUTES: (1000 * 60),
    MILLISECONDS_TO_HOURS: (1000 * 60 * 60)
  }

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
      startDate: {
        aliasOf: 'sourceLayer.timeInfo.fullTimeExtent.start'
      },
      progressConversionFactor: {
        type: Number,
        value: DATE_CONVERSION_FACTORS.MILLISECONDS_TO_HOURS
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
        size: 5,
        color: '#cccccc',
        lineWidth: 5,
        lineColor: '#dddddd',
        cutoffTime: (DATE_CONVERSION_FACTORS.HOURS_TO_MINUTES * 10.0),
        opacityAtCutoff: 0.1,
      };

      // RENDERER //
      this.renderer = new AnimatedRouteRenderer();
      // RENDERER ASSETS //
      this.renderer.registerAssets([
        ['arrow', 'https://apl.esri.com/jg/SoCalRoutes/app/symbols/arrow.png'],
        ['marker', 'https://apl.esri.com/jg/SoCalRoutes/app/symbols/marker.png'],
        ['circle', 'https://esri-audubon.s3-us-west-1.amazonaws.com/v1/apps/assets/textures/full-circle.png'],
        ['bird', 'https://esri-audubon.s3-us-west-1.amazonaws.com/v1/apps/assets/textures/osprey.png']
      ]);
      // RENDERER SYMBOLS //
      this.renderer.setSymbol('default', {
        ...defaultSymbol
      });
      this.renderer.setSymbol('moving', {
        ...defaultSymbol,
        type: 'arrow',
        size: 16,
        color: '#d9832e',
        lineColor: '#ffff00'
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

      // GET SOURCE FEATURES //
      this.getSourcesFeatures(this.sourceLayer).then(({ features }) => {
        console.info('Source Feature Count: ', features.length);

        // LAYER START DATE VALUE //
        const layerStartDateValue = this.startDate.valueOf();

        // SOURCE BY ID //
        const sourcesByID = features.reduce((list, feature) => {

          // SOURCE ID //
          const sourceId = feature.attributes[this.trackIdField];
          const startTimeMoment = moment.utc(feature.attributes[this.startDateField]);
          // START OFFSET - MILLISECONDS TO ... //
          const startOffset = (startTimeMoment.toDate().valueOf() - layerStartDateValue) / this.progressConversionFactor;

          // GET ALL COORDINATES //
          const coordinates = feature.geometry.paths.reduce((geomCoords, path) => {
            const pathCoords = path.map(coords => {
              // CONVERT FROM MINUTES ALONG //
              if(coords.length > 2){
                // MINUTES TO ... //
                coords[2] = (startOffset + (coords[2] / DATE_CONVERSION_FACTORS.MINUTES_TO_HOURS));
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
            sourceInfo = { id: sourceId, geometry: coordinates, attributes: feature.attributes };
          }

          return list.set(sourceId, sourceInfo);
        }, new Map());

        // SORT COORDS BY TIME //
        //  - IS THIS STILL NECESSARY?
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
