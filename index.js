var express = require('express');
var cors = require('cors');
var getJourneys = require('./journeyRetriever');

var app = express();
app.use(cors());

app.get("/journeys", function(req, res) {
    getJourneys()
        .then(function(journeys) {
            res.status(200).json(journeys);
        });
});

var port = 4000;

app.listen(port, function(){
  console.log('Express started on http://localhost:' + port);
});