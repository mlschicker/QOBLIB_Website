(function () {
  function normalize(value) {
    return (value || "").toString().trim().toLowerCase();
  }

  function filterValue(scope, selector) {
    var element = scope.querySelector(selector);
    return element ? element.value : "";
  }

  function initScopedFilters() {
    var scopes = Array.prototype.slice.call(document.querySelectorAll("[data-filter-scope]"));

    scopes.forEach(function (scope) {
      var name = scope.getAttribute("data-filter-scope");
      var table = document.querySelector('[data-filter-table="' + name + '"]');
      if (!table) {
        return;
      }

      var output = scope.querySelector("[data-result-count]");
      var label = output ? output.getAttribute("data-result-label") || "rows" : "rows";
      var rows = Array.prototype.slice.call(table.querySelectorAll("tbody tr"));

      function applyFilters() {
        var query = normalize(filterValue(scope, "[data-search]"));
        var problem = filterValue(scope, "[data-problem-filter]");
        var modeling = filterValue(scope, "[data-modeling-filter]");
        var algorithm = filterValue(scope, "[data-algorithm-filter]");
        var status = filterValue(scope, "[data-status-filter]");
        var visible = 0;

        rows.forEach(function (row) {
          var matches = true;
          if (query && normalize(row.getAttribute("data-search")).indexOf(query) === -1) {
            matches = false;
          }
          if (problem && row.getAttribute("data-problem") !== problem) {
            matches = false;
          }
          if (modeling && row.getAttribute("data-modeling") !== modeling) {
            matches = false;
          }
          if (algorithm && row.getAttribute("data-algorithm") !== algorithm) {
            matches = false;
          }
          if (status && row.getAttribute("data-status") !== status) {
            matches = false;
          }
          row.hidden = !matches;
          if (matches) {
            visible += 1;
          }
        });

        if (output) {
          output.textContent = visible.toLocaleString() + " " + label;
        }
      }

      Array.prototype.slice.call(scope.querySelectorAll("input, select")).forEach(function (element) {
        element.addEventListener("input", applyFilters);
        element.addEventListener("change", applyFilters);
      });
      applyFilters();
    });
  }

  function sortableValue(row, index) {
    var cell = row.children[index];
    if (!cell) {
      return "";
    }
    return cell.getAttribute("data-sort") || cell.textContent || "";
  }

  function parseSortable(value) {
    var text = value.toString().trim();
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
      return { type: "number", value: parseFloat(text) };
    }
    var timestamp = Date.parse(text);
    if (!Number.isNaN(timestamp)) {
      return { type: "number", value: timestamp };
    }
    return { type: "text", value: normalize(text) };
  }

  function compareValues(left, right) {
    var a = parseSortable(left);
    var b = parseSortable(right);
    if (a.type === "number" && b.type === "number") {
      return a.value - b.value;
    }
    if (a.value < b.value) {
      return -1;
    }
    if (a.value > b.value) {
      return 1;
    }
    return 0;
  }

  function initSortableTables() {
    Array.prototype.slice.call(document.querySelectorAll("[data-sort-table]")).forEach(function (table) {
      var tbody = table.querySelector("tbody");
      if (!tbody) {
        return;
      }
      var headers = Array.prototype.slice.call(table.querySelectorAll("thead th"));
      var originalRows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));

      headers.forEach(function (header, index) {
        header.setAttribute("tabindex", "0");
        header.setAttribute("role", "button");

        function sortColumn() {
          var descending = header.getAttribute("aria-sort") === "ascending";
          headers.forEach(function (item) {
            item.removeAttribute("aria-sort");
          });
          header.setAttribute("aria-sort", descending ? "descending" : "ascending");

          var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
          rows.sort(function (left, right) {
            var result = compareValues(sortableValue(left, index), sortableValue(right, index));
            if (result === 0) {
              return originalRows.indexOf(left) - originalRows.indexOf(right);
            }
            return descending ? -result : result;
          });
          rows.forEach(function (row) {
            tbody.appendChild(row);
          });
        }

        header.addEventListener("click", sortColumn);
        header.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            sortColumn();
          }
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initScopedFilters();
    initSortableTables();
  });
})();
