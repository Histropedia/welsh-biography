
/* Runs Wikidata queries to update timeline data
 * Updates en-GB and cy biography-events.js files in public/data folder
 */
require('dotenv').config();
var QueryDispatcher = require('./data-update/query-dispatcher');
var generateTimelineData = require('./data-update/generate-timeline-data');
var queries = require('./data-update/queries');
var PROPERTY_LABELS = require('./data-update/options').PROPERTY_LABELS;
var fs = require('fs');
var debug = require('debug')('dwb:data-update');

var endpointUrl = 'https://query.wikidata.org/sparql';
var queryDispatcher = new QueryDispatcher(endpointUrl);
var coreDataEnPromise = queryDispatcher.query( queries.coreDataEn ),
    coreDataCyPromise = queryDispatcher.query( queries.coreDataCy ),
    filterDataPromise = queryDispatcher.query( queries.filterData ),
    contextDataEnPromise = queryDispatcher.query( queries.contextDataEn ),
    contextDataCyPromise = queryDispatcher.query( queries.contextDataCy ),
    itemLabelsEnPromise = queryDispatcher.query( queries.itemLabelsEn ),
    itemLabelsCyPromise = queryDispatcher.query( queries.itemLabelsCy );

debug("Queries sent...");

Promise.all([
  coreDataEnPromise,
  coreDataCyPromise,
  filterDataPromise,
  contextDataEnPromise,
  contextDataCyPromise,
  itemLabelsEnPromise,
  itemLabelsCyPromise
])
.then(function(values) {
    // Process and combine results to generate timeline data
    debug("All queries completed, start processing..."); 
    var coreDataEn = values[0],
    coreDataCy = values[1],
    filterData = values[2],
    contextDataEn = values[3],
    contextDataCy = values[4],
    itemLabelsEn = values[5],
    itemLabelsCy = values[6];
    
    
    // Todo: automate from languages in app config
    var articleDataEn = generateTimelineData({
      coreData: coreDataEn,
      contextData: contextDataEn,
      filterData: filterData, 
      lang: 'en-GB'
    });

      // Todo: automate from languages in app config
    var articleDataCy = generateTimelineData({
      coreData: coreDataCy,
      contextData: contextDataCy,
      filterData: filterData,
      lang: 'cy'
    });

    itemLabelsEn = generateLabelData(itemLabelsEn, "en-GB");
    itemLabelsCy = generateLabelData(itemLabelsCy, "cy");

    writeTimelineData({articles: articleDataEn, labels: itemLabelsEn}, "en-GB");
    writeTimelineData({articles: articleDataCy, labels: itemLabelsCy}, "cy");
    debug("Update complete!")

  })
  .catch(function(err) {
    debug("something went wrong running at least one of the update queries")
    debug(err)
    // attempt to re-run the update after a wait period
    // if failed multiple times, send error in email to developer
  })

// Todo: Use writePublicData function instead once timeline data swithces to .json
function writeTimelineData(timelineData, lang) {
  var fileContents = JSON.stringify(timelineData);
  fs.writeFile('./public/data/' + lang + '/timeline-data.json', fileContents, function (err) {
    if (err) throw err;
    debug ("Timeline data written to disk")
  });
}

function writePublicData(data, path) {
  var fileContents = JSON.stringify(data);
  fs.writeFile('./public/data/' + path, fileContents, function (err) {
    if (err) throw err;
  });
}

function generateLabelData(itemLabelResults, lang) {
  var results = itemLabelResults.results.bindings;
  var itemLabels = {};
  for (var i=0; i<results.length; i++) {
    var result = results[i];
    if (result.item && result.valueLabel) {
      itemLabels[result.item.value] = result.valueLabel.value;
    } else {
      debug("Label query results must have 'item' and 'valueLabel' properties")
    }
  }

  // Property labels are set for each UI language in options
  // Todo: fallback to Wikidata query results when no value set in options
  var propertyLabels = PROPERTY_LABELS[lang];

  return {
    items: itemLabels,
    properties: propertyLabels
  };
}


  