/* Generates timeline data from Wikidata query results 
 * Combines separate coreData and filterData query results
 * Returns timeline data in HistropediaJS format 
 */
require('dotenv').config();
var debug = require('debug')('dwb:data-update:generate-timeline-data');
var DATE_LABELS = require('./options').DATE_LABELS;

 // Dictionary of Welsh Biography uses different domains for en and cy version
 var biographyUrlRoot = {
   "en-GB": 'https://biography.wales/article/',
   "cy": "https://bywgraffiadur.cymru/article/"
 }


module.exports = function(coreData, filterData, lang) {
  var lang = lang || "en-GB";
  var articleData = coreData.results.bindings.map(function(result) {
    var nextArticle = {
      id: parseInt(result.id.value),
      title: result.title.value,
      rank: parseInt(result.rank.value),
      from: getPrecisionFixedDate({
        year: parseInt(result.from_year.value),
        month: parseInt(result.from_month.value),
        day: parseInt(result.from_day.value),
        precision: parseInt(result.from_precision.value),
      }),
      dwbUrl: biographyUrlRoot[lang] + result.dwbId.value
    }
    if (result.imageUrl) nextArticle.imageUrl = result.imageUrl.value;
    if (result.article) nextArticle.article = result.article.value;
    if (result.description) nextArticle.description = result.description.value;
    if (result.to_year) {
      nextArticle.to = getPrecisionFixedDate({
        year: parseInt(result.to_year.value),
        month: parseInt(result.to_month.value),
        day: parseInt(result.to_day.value),
        precision: parseInt(result.to_precision.value),
      })
    } else {
      // If no end date, copy start date so precision can be used to set time span
      nextArticle.to = {
        year: nextArticle.from.year,
        month: nextArticle.from.month,
        day: nextArticle.from.day,
        precision: nextArticle.from.precision,
      }
    }

    nextArticle.subtitle = getPrettyDate(nextArticle.from, lang) + ' - ' + getPrettyDate(nextArticle.to, lang);
    return nextArticle;
  })

  // Add filters to articleData
  articleData = addFiltersToArticleData(articleData, filterData);
  return {data: articleData, lang: lang};
}

function addFiltersToArticleData(articleData, filterData) {
  filterData = filterData.results.bindings;
  for (var i=0; i<articleData.length; i++) {
    var article = articleData[i];
    var articleStatements = {};

    for (var j=0; j<filterData.length; j++) {
      var articleFilterData = filterData[j];

      if (parseInt(articleFilterData.id.value) === article.id ) {
        for (var filterProperty in articleFilterData) {
          if (filterProperty === 'id') continue;
          articleStatements[filterProperty] = {values: articleFilterData[filterProperty].value.split("|")};
        }
        break;
      }
    }
    article.statements = articleStatements;
  }
  return articleData;
}

function getPrecisionFixedDate(date) {
  // Wikidata dates at low precision can have inconsistent values for day, month, year
  // This function unifies them so each precision uses the same rules
  // See https://www.wikidata.org/wiki/Help:Dates for more info on the ranges of values covered by each precision
   // Todo: Check for BC dates

  var precision = date.precision;
  if (precision <= 9) date.month = 1;
  if (precision <= 10) date.day = 1;

  if (precision > 8) return date;

  switch (precision) {
    case 8:
      // Decade precision
      date.year = Math.floor(date.year/10) * 10;
      break;
    case 7:
      // Century precision
      date.year = Math.ceil(date.year/100) * 100;
      break;
    case 6:
      // Millennium precision
      date.year = Math.ceil(date.year/1000) * 1000;
      break;
    default:
      debug("Unknown precision: ", precision);
  }
  return date;
}

function getPrettyDate(date, lang) {
  // Todo: Check for BC dates
  var lang = lang || "en-GB",
  year = date.year,
  month = date.month,
  day = date.day,
  bceText = (date.year < 1) ? getBceText(lang) : '',
  dateString;
  switch (date.precision) {
    case 11:
      dateString = day + ' ' + getMonthLabel(month, lang) + ' ' + year;
    case 10:
      dateString = getMonthLabel(month, lang) + ' ' + year;
    case 9:
      dateString = year + bceText;
    case 8:
      dateString = year + getPeriodLabel("decade", lang);
    case 7:
      dateString = year / 100 + ' . ' + getPeriodLabel("century", lang);
    case 6:
      dateString = year / 1000 + ' . ' + getPeriodLabel("millennium", lang);
  }
  
  dateString += bceText;
  return dateString;
}

function getMonthLabel(number, lang) {
  return DATE_LABELS[lang].months[number - 1];
}

function getPeriodLabel(period, lang) {
  return DATE_LABELS[lang].periods[period];
}

function getBceText(lang) {
  return DATE_LABELS[lang].bceText;
}