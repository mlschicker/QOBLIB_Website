(function () {
  function normalize(value) {
    return (value || "").toString().trim().toLowerCase();
  }

  function initFilterTable() {
    var table = document.querySelector("[data-filter-table]");
    if (!table) {
      return;
    }

    var search = document.querySelector("[data-search]");
    var problem = document.querySelector("[data-problem-filter]");
    var modeling = document.querySelector("[data-modeling-filter]");
    var algorithm = document.querySelector("[data-algorithm-filter]");
    var output = document.querySelector("[data-result-count]");
    var rows = Array.prototype.slice.call(table.querySelectorAll("tbody tr"));

    function applyFilters() {
      var query = normalize(search && search.value);
      var problemValue = problem && problem.value;
      var modelingValue = modeling && modeling.value;
      var algorithmValue = algorithm && algorithm.value;
      var visible = 0;

      rows.forEach(function (row) {
        var matches = true;
        if (query && normalize(row.getAttribute("data-search")).indexOf(query) === -1) {
          matches = false;
        }
        if (problemValue && row.getAttribute("data-problem") !== problemValue) {
          matches = false;
        }
        if (modelingValue && row.getAttribute("data-modeling") !== modelingValue) {
          matches = false;
        }
        if (algorithmValue && row.getAttribute("data-algorithm") !== algorithmValue) {
          matches = false;
        }
        row.hidden = !matches;
        if (matches) {
          visible += 1;
        }
      });

      if (output) {
        output.textContent = visible.toLocaleString() + " rows";
      }
    }

    [search, problem, modeling, algorithm].forEach(function (element) {
      if (element) {
        element.addEventListener("input", applyFilters);
        element.addEventListener("change", applyFilters);
      }
    });
    applyFilters();
  }

  document.addEventListener("DOMContentLoaded", initFilterTable);
})();
