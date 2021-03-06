angular.module('app.game', [])
  .controller('gameController', function($scope, $timeout, $interval, $http, gameOver, trackScore, trackSession){
    angular.extend($scope, gameOver);

    // code editor settings
    $scope.editorOptions = {
        lineWrapping : true,
        lineNumbers: true,
        tabSize: 2,
        autofocus: true
    };

    // sets up initial scope variables
    $scope.challengeFixtures;
    $scope.totalScore = trackScore;
    $scope.showMessage = false;
    $scope.gameOver = false;

    // helper methods
    var setNewBatch = function(resultsObject){
      $scope.level = 0;
      $scope.challengeFixtures = resultsObject.data[0].batch;
    };

    var startNewLevel = function(){
      $scope.challenge = $scope.challengeFixtures[$scope.level]['content'];
      $scope.timeLimit = $scope.challengeFixtures[$scope.level]['timeLimit'];
    };

    // requests a new session id from the database
    trackSession.getSession();

    // gets the challenge content from the server for the first batch
    // and saves the content in the first level to scope variables that the DOM can access
    $http.get('/api/challengeBatch/0')
    .then(function(res){
      $scope.batch = 0;
      setNewBatch(res);
      startNewLevel();
    });

    // sets up the timer
    var stop;
    var start = function(timeLimit){
      stop = $interval(function(){
        $scope.timeLimit--;
        // if the timer runs out before a successful submit, the player loses
        if ($scope.timeLimit === 0){
          $interval.cancel(stop);
          $scope.gameOver = true;
          $timeout(function(){
            gameOver.checkScore($scope.totalScore);
          }, 2500);
        }
      }, 1000);
    };
    // start the timer for the first challenge
    start();


    $scope.checkSolution = function(playerSolution){
      if ($scope.challenge === playerSolution) {
        // stops timer
        $interval.cancel(stop);
        stop = undefined;

        // shows 'correct' message
        $scope.submitMessage = 'You are amazing!'
        $scope.showMessage = true;

        // increase user's level
        $scope.level++;

        // get user's score for this level and add it to total score
        $scope.score = $scope.timeLimit;
        $http.post('/api/sessions', {
          session: trackSession.sessionId,
          score: $scope.score
        }).then(function(res){
          // set the factory score variable to the score returned
          trackScore.totalScore = res.data;
        });

        // after a pause
        $timeout(function(){
          // removes win message
          $scope.showMessage = false;
          // resets textarea
          $scope.playerSolution = "";

          // if that was the last challenge in challengeFixtures
          if ( $scope.challengeFixtures[$scope.level] === undefined ){
            // get next batch from server
            $scope.batch++;
            $http.get('/api/challengeBatch/' + $scope.batch)
            .then(function(res){
              // if the next batch is empty
              if (!res.data.length){
                // tell the user they won and check if the score is high enough for the leaderboard
                $scope.gameWon = true;
                $timeout(function(){
                  gameOver.checkScore($scope.totalScore);
                }, 2500);
              // otherwise
              } else {
                // set up the next batch + challenge
                setNewBatch(res);
                startNewLevel();
                start();
              }
            });
          // otherwise
          } else {
            // set up the next challenge
            startNewLevel();
            start();
          }
        }, 1500);
      } else {
        // shows 'incorrect' message
        $scope.submitMessage = 'You suck.'
        $scope.showMessage = true;
      }
    };

    $scope.checkChar = function(textArr){
      if(textArr.length > 0){
        if(textArr === $scope.challenge){
          $scope.checkSolution(textArr);
        }else if(textArr[textArr.length-1] === $scope.challenge[textArr.length-1]){
          //the just typed letter is equal to that in same index of soltn
          if($scope.incorrectBool){//a past value was wrong
            //change to true if values were fixed
            if(textArr[$scope.incorrectIndex] === $scope.challenge[$scope.incorrectIndex]){
              $scope.incorrectBool = false;
            }
          }
        }else{
          //the current value is not equal
          $scope.incorrectBool = true;
          // $scope.incorrectChar = textArr[textArr.length-1];
          $scope.incorrectIndex = textArr.length-1;
        }
      }
    };


  })
  // combine these 3 factories into one called scoreFactory
  .factory('gameOver', function($http, $state){
    var obj = {};
    obj.checkScore = function(playerScore) {
      $http.get('/api/minHighscore')
        .then(function(res){
          var minHighscore = res.data;
          if (playerScore.totalScore < minHighscore) {
            $state.transitionTo('leaderboard');
          } else {
            $state.transitionTo('setInitials');
          }
        })
    };

    return obj;
  })
  // this creates a score variable that we can pass to the setInitials view
  .factory('trackScore', function(){
    var obj = {};
    obj.totalScore = 0;
    return obj;
  })
  // this creates a session variable that we can pass to the setInitials view
  .factory('trackSession', function($http){
    var obj = {};

    obj.sessionId;

    obj.getSession = function(){
      $http.post('/api/sessions')
      .then(function(res){
        obj.sessionId = res.data.session;
      });
    };

    return obj;
  });
