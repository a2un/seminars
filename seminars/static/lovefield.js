/******  Begin schema creation  ****/
//Define beantheory.db namespace
var db = null;
var beantheory = { db: {} };

/** @return {!lf.schema.Builder} */
beantheory.db.getSchemaBuilder = function() {
  var schemaBuilder = lf.schema.create('beantheory', 1);
  schemaBuilder.createTable('talks').
      addColumn('uid', lf.Type.STRING). //  == series_id/series_ctr
      addColumn('series_id', lf.Type.STRING).
      addColumn('series_ctr', lf.Type.INTEGER).
      addColumn('topics', lf.Type.STRING). // concatenated with pipes at the end and beginning
      addColumn('language', lf.Type.STRING).
      addColumn('start_time', lf.Type.DATE_TIME).
      addColumn('end_time', lf.Type.DATE_TIME).
      addColumn('past_oneline', lf.Type.string).
      addColumn('future_oneline', lf.Type.string).
      addColumn('saved', lf.Type.BOOLEAN). // null if not logged in
      addPrimaryKey(['uid']).
      addNullable(['future_oneline', 'past_oneline', 'saved']).
      addIndex('idxStartTime', ['start_time'], false, lf.Order.ASC).
      addIndex('idxStartTimeDSC', ['start_time'], false, lf.Order.DESC);
  return schemaBuilder;
}



/**** User ****/
var current_user = {
  anonymous: true,
  saved_talks: {},
  saved_series: [],
}









function checkForExistingData() {
  var talks = db.getSchema().table('talks');
  var column = lf.fn.count(talks.uid);
  return db.select(column).from(talks).exec().then(
      function(rows) {
        console.log(rows[0][column.getName()]);
        return rows[0][column.getName()] > 0;
      });
}




var insertOrReplace_talks = function(data) {
  console.log("insertOrReplace_talks")
  console.log(data.code);
  if (data.code == "success") {
      talks = db.getSchema().table('talks');
      rows = [];
      data.results.forEach( elt => {
        rows.push(
          talks.createRow({
            'uid' : elt.seminar_id + '/' + elt.seminar_ctr,
            'series_id' : elt.seminar_id,
            'series_ctr' : elt.seminar_ctr,
            'topics' : '|' + elt.topics.join('|') + '|',
            'language' : elt.language,
            'start_time' : new Date(elt.start_time),
            'end_time' : new Date(elt.end_time),
            'past_oneline' : elt.past_oneline,
            'future_oneline' : elt.future_oneline,
          })
        )
      })
      return db.insertOrReplace().into(talks).values(rows).exec();
  }
  return Promise.reject();
};

var fetch_talks = function(query) {
  console.log(query);
  var request = new XMLHttpRequest();
  return new Promise(function (resolve, reject) {
    // Setup our listern to process complete requests
    request.onreadystatechange = function() {
    // Only run if the request is complete
		if (this.readyState !== 4) return;

      // Process the response
      if (this.status >= 200 && this.status < 300) {
        return resolve(JSON.parse(this.responseText));
      } else {
        // If failed
        reject({
          status: this.status,
          statusText: this.statusText
        });
      }
    }
    //FIXME
    //request.open("POST", "https://test.researchseminars.org/api/browse/talks", true);
    request.open("POST", "/api/browse/talks", true);
    request.setRequestHeader('Content-type', 'application/json');
    request.send(JSON.stringify({'query': query}))
  });
}

//search_and_insert_talks({'end_time' : {'$gte': '2020-09-24 15:45:00-04:00'}});
function loadAllTalks(query) {
  return fetch_talks(query).then(insertOrReplace_talks);
}





function countTopics() {
  var talks = db.getSchema().table('talks');
  return db.select(talks.topics).from(talks).exec().then(
    function(results) {
      var counter = {};
      results.forEach(
        function(row) {
          row.topics.split('|').forEach(
            function(topic) {
              if( topic ){
                if( !(topic in counter) ) {
                  counter[topic] = 0;
                }
                counter[topic] += 1;
              }
            })
        }
      );
      var pairs = Object.keys(counter).map(function(key) {
        return [key, counter[key]];
      });
      // Sort the array based on the second element
      pairs.sort(function(first, second) {
        return second[1] - first[1];
      });
      var table = document.createElement("table");
      var newRow = document.createElement("tr");
      var topic = document.createElement("th")
      topic.innerText = "topic";
      newRow.appendChild(topic);
      var count = document.createElement("th");
      count.innerText = "count";
      newRow.appendChild(count);
      table.appendChild(newRow);
      for (const [key, value] of pairs) {
        var newRow = document.createElement("tr");
        var topic = document.createElement("td")
        topic.innerText = key;
        newRow.appendChild(topic);
        var count = document.createElement("td");
        count.innerText = value;
        newRow.appendChild(count);
        table.appendChild(newRow);

      }
      document.body.appendChild(table);
      });
}

function convertTopics(topics_string) {
  return new Set(topics_string.substring(1, topics_string.length - 1).split('|'))
}

function hasCommonElement(a, b) {
  for(const elt in a) {
    if( b.has(elt) ) {
      return true;
    }
  }
  return false;
}



function displayTalks() {
  past = document.body.querySelector('input[name="past"]').value == "True";
  //FIXME
  filteredTopics = new Set();
  filteredLanguages = new Set();
  var talks = db.getSchema().table('talks');
  return db.select().
    from(talks).
    where((past) ? talks.end_time.lte(new Date()) : talks.end_time.gte(new Date())).
    orderBy(talks.start_time, (past) ? lf.Order.DESC : lf.Order.ASC).
    exec().then(
    function(results) {
      console.log("foo");
      let tbody = document.querySelector("table#browse-talks > tbody");
      //FIXME add tbody
      let index = 0;
      results.forEach(function(talk) {
        let newRow = document.createElement("tr");
        newRow.classList.add("talk")
        newRow.classList.add("lang-" + talk.language)
        if( index % 2 == 0) {
          newRow.classList.add("evenrow")
        } else {
          newRow.classList.add("oddrow")
        }
        index += 1;


        newRow.innerHTML = talk.future_oneline;
        let topics = convertTopics(talk.topics);
        topics.forEach(elt => newRow.classList.add("topic-" + elt))
        if( talk.saved === false ) {
          newRow.classList.add('calendar-filtered')
        }
        if( !hasCommonElement(topics, filteredTopics) ) {
          newRow.classList.add('topic-filtered')
        }
        if( !hasCommonElement(topics, filteredLanguages) ) {
          newRow.classList.add('language-filtered')
        }

        tbody.appendChild(newRow)
      })
    })
}


// When the page loads.
document.addEventListener("DOMContentLoaded", function(){
  main().then(function () { countTopics()});
  function main() {
    return beantheory.db.getSchemaBuilder().connect({
      //FIXME?
      storeType: lf.schema.DataStoreType.MEMORY
    }).then(function(database) {
      db = database;
      console.log("foo");
      return checkForExistingData();
    }).then(function(dataExist) {
      return dataExist ? Promise.resolve() : loadAllTalks({});
    }).then(displayTalks);
  }
});
