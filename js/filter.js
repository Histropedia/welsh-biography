//  Extends App class with all filter related properties and methods
//
//  Sets up filters from properties chosen in App.options
//  After setup you can Add/Remove filters by property and value
//  Search results for each filter are only generated when panel opens

(function() { 
    
    window.filterData = { // todo: make private after development
        //  P27 : {
        //      label: "Place of birth"
        //      searchResults: [ {label: "london", value:"Q84", count: 23}, ..]
        //      select2 :
        //  },
    }

    
    App.prototype.setupFilterOptions = function () {
        var optionsElements = [];
        var searchBoxElements = []
        for (var property in this.options.filters) {
            var filter = this.options.filters[property],
                $optionElement = $(getFilterOptionHtml(property, filter.label)),
                $searchElement = $(getSearchBoxHtml(property));
            
            // add property to state
            this.state.appliedFilters[property] = [];
            
            // setup filter data
            filterData[property] = {
                label: filter.label,
                $search: $searchElement,
                needsUpdate: true, // only update search results needed
            }
            
            // add option for filter types panel
            optionsElements.push($optionElement);
            
            // add search box on filter panel
            searchBoxElements.push($searchElement);
        }
        
        // append generated html
        $('#filter-types-list-container').html(optionsElements);
        $('#filter-search-panel .filter-panel-content').append(searchBoxElements);
        
        // wrap in divs for easy hide/show
        $('.filter-panel-search').wrap('<div class="filter-search-container"></div>');
        
        // add filter on select
        var me = this;
        $('.filter-panel-search').on('select2:select', function(ev) {
            var selected = ev.params.data;
            me.addFilter(selected.property, selected.id);
            me.closeFilterSearchPanel();
            me.closeFilterTypesPanel();
            
        })
        
        function getFilterOptionHtml(property, label) {
            //todo: get label from property id
            return '<button type="button" filter-property=' + property + ' class="btn btn-outline-secondary btn-lg" style="text-align: left">' + label + '<i class="fas fa-chevron-right"></i> <span class="label-selected-filters"> </span> </button>';
        }
        
        function getSearchBoxHtml(filterProperty) {
            // wrap search in div to allow easy show/hide
            return '<select class="filter-panel-search" filter-property="{{property}}" style="width:100%"></select>'
                .replace('{{property}}', filterProperty);
        }
        
    }
    
    App.prototype.addFilter = function(property, value) {
        this.state.appliedFilters[property].push(value);
        this.applyFilters();
        this.filtersChanged();
    }    
    
    App.prototype.removeFilter = function(property, value) { 
        var propertyFilters = this.state.appliedFilters[property];
        if (!propertyFilters) return console.error("no filter setup for property: ", property);
        
        var valueIndex = propertyFilters.indexOf(value);
        if (valueIndex === -1) return console.error("no filter found using value: ", value);
        propertyFilters.splice(valueIndex, 1);
        this.applyFilters();
        this.filtersChanged();
    }
    
    App.prototype.filtersChanged = function () {
        for (var prop in filterData) {
            // notify filter search boxes need update
            filterData[prop].needsUpdate = true;
        }
    }
    
    App.prototype.applyFilters = function () {
    //sets the visibility of all articles on the timeline according to currently applied filters
        var appliedFilters = this.state.appliedFilters;
        
        //check all articles on the timeline
        this.timeline.forLoadedArticles(function(article) {
            article.hiddenByFilter = !getArticleVisiblityFromFilters(article, appliedFilters);
        })
        
        this.timeline.defaultRedraw();
    }
    
    /****************** Filter panels ******************/
    
    App.prototype.openFilterTypesPanel = function () {
        $('#filter-types-panel').show();
        this.state.filterPanel.isOpen = true;
    }
    
    App.prototype.closeFilterTypesPanel = function () {
        $('#filter-types-panel').hide();
        this.state.filterPanel.isOpen = false;
    }
    
    App.prototype.openFilterSearchPanel = function (property) {
        $('#filter-search-panel').show();
        var filterSettings = filterData[property];
        var needsUpdate = filterSettings.needsUpdate;
        
        if (needsUpdate) {
            this.updateFilterSearchResults(property);
        }
        
        // update the property lable in title of the filter panel
        $('#filter-property-label').text(filterSettings.label);
        
        $('.filter-search-container').hide();
        filterSettings.$search.parent().show();
        
        this.state.filterPanel.panel = property;
    }
    
    App.prototype.closeFilterSearchPanel = function () {
        $('#filter-search-panel').hide();
        this.state.filterPanel.panel = "";
    }
    
    /****************** Filter search ******************/
    
    App.prototype.updateFilterSearchResults = function(filterProperty) {
        // select2 does not support templated results for dynamically added options
        // so we need to destroy and re-initialise the search box
        
        var filterSettings = filterData[filterProperty],
            articles = this.timeline.articles,
            filterValues = {};
        
        for (var i=0; i < articles.length; i++) {
            var statement = articles[i].data.statements[filterProperty];
            if (articles[i].isHiddenByFilter || !statement || statement.values.length === 0) continue; 
            
            for (var j=0; j < statement.values.length; j++) {
                var valueId = statement.values[j]; // this is the Wikidata item number of the value
                    valuelabel = valueId; // todo: use a getLabel function
                if (filterValues.hasOwnProperty(valueId)) {
                    // increment counter if already seen
                    filterValues[valueId].count += 1;
                } else {
                    // if not, create a new entry
                    filterValues[valueId] = {
                        id: valueId,
                        text: valuelabel,
                        count: 1,
                        property: filterProperty
                    }
                }
                // check next statement value ...
            }
            // check next article ...
        }
        
        var sortedList = Object.values(filterValues).sort(function(a, b) {
            return b.count - a.count;
        })
        
        reInitialiseSelect2(sortedList);
        filterSettings.needsUpdate = false;
        
        function reInitialiseSelect2(results) {
            var data = filterData[filterProperty],
                $controlElement = data.$search;
            
            // remove the old select2 instance if present
            if ($controlElement.data('select2')) $controlElement.select2("destroy");
            
            // remove option tags 
            $($controlElement).empty();
            
            // re-initialise with 
            $controlElement.select2({
                data: results,
                placeholder: 'Search for ' + filterProperty + ' filters',
                templateResult: searchResultsFormat,
            });
            
            $controlElement.val(null).trigger('change'); // start with nothing selected
           
        }
        
        // select2 results template
        function searchResultsFormat(state) {
            if (!state.id) {
                return state.text;
            }
            var $state = $('<span class="filter-result-label">' + state.text + '</span><span class="filter-result-count">&nbsp;' + '(' + state.count + ')' + '</span>');
            return $state;
        }
    }
    
    /****************** Private functions ******************/
    
    function getArticleVisiblityFromFilters(article, appliedFilters) {
        //article will not be visible if it fails to match any active filters
        
        var articleStatements = article.data.statements;
        
        for (var property in appliedFilters) {
            var propertyFilters = appliedFilters[property]
            if (propertyFilters.length === 0) continue;

            //active filters found for this property, now check if the article has matching values
            var articleStatements = articleStatements[property].values;
            if (!articleStatements) return false;

            //article has statements using this property, check if each active filter value is present
            for (var i=0; i < propertyFilters.length; i++) {
                //is this filter value missing from the article's statements?
                if (!articleStatements.includes(propertyFilters[i])) {
                    //yes? article must be hidden
                    return false;
                }
            }
            //check next filter property...
        }
        //all filter properties and values exist in article statements, so it's visible
        return true
    }
    
})()