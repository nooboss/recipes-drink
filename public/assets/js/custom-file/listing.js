"use strict";

// Class definition
var KTCustomersList = function () {
    // Define shared variables
    var datatable;

    var table = document.getElementById('kt_customers_table')

    // Private functions
    var initCustomerList = function () {
        // Set date data order

        // Init datatable --- more info on datatables: https://datatables.net/manual/
        datatable = $(table).DataTable({
            columnDefs: [
                {
                    targets: 1, // Adjust this index to the correct column for dates
                    render: function (data, type, row) {
                        // Check if the data is a valid date
                        const date = new Date(data);

                        // Check if the parsed date is valid
                        if (!isNaN(date.getTime())) {
                            return type === 'display' ? moment(date).format('D MMM, YYYY') : data;
                        }

                        // If not a valid date, return the original data
                        return data;
                    }
                }
            ]
        });

        // Re-init functions on every table re-draw -- more info: https://datatables.net/reference/event/draw
        datatable.on('draw', function () { });
    }

    // Search Datatable --- official docs reference: https://datatables.net/reference/api/search()
    var handleSearchDatatable = () => {
        const filterSearch = document.querySelector('[data-kt-customer-table-filter="search"]');
        filterSearch.addEventListener('keyup', function (e) {
            datatable.search(e.target.value).draw();
        });
    }

    var handleCategoryFilter = () => {
        const categoryFilter = document.querySelector('[data-kt-category-filter="category"]');
    
        if (categoryFilter) { // Check if the category filter exists
            $(categoryFilter).on('change', e => {
                const value = e.target.value === 'all' ? '' : e.target.value; // Set value to '' if 'all' is selected
    
                datatable.search(value).draw(); // Apply search to the DataTable
            });
        }
    };
    
    // Public methods
    return {
        init: function () {
            table = document.querySelector('#kt_customers_table');

            if (!table) {
                return;
            }

            initCustomerList();
            handleSearchDatatable();
            handleCategoryFilter();
        }
    }
}();

// On document ready
KTUtil.onDOMContentLoaded(function () {
    KTCustomersList.init();
});