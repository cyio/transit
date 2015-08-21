(function() {
  var app;

  app = angular.module('TransitOptionsApp', []);

  app.controller('OptionsCtrl', function($scope, $window) {
    return initOptions(function() {
      var name, saveOptions, _results;
      $scope.options = options;
      $scope.$apply();
      saveOptions = function() {
        return chrome.storage.sync.set($scope.options);
      };
      _results = [];
      for (name in options) {
        _results.push($scope.$watch("options." + name, saveOptions));
      }
      return _results;
    });
  });

}).call(this);
