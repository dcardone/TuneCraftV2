const express = require("express");
const app = express();
const path = require("path");
const axios = require("axios");
app.set("view engine", "ejs");
app.set("views", path.resolve(__dirname, "templates"));
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config({
  path: path.resolve(__dirname, "credentials/.env"),
});

const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static(__dirname + "/public"));

const PORT = process.env.PORT || 10000;
app.use(express.static(path.join(__dirname, "public")));

let userId;
let database;
let collection;
let client;

const databaseName = "TuneCraftDB";
const collectionName = "UserLogs";

(async () => {
  const uri = process.env.MONGO_CONNECTION_STRING;
  client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

  try {
    await client.connect();
    database = client.db(databaseName);
    collection = database.collection(collectionName);
  } catch (e) {
    console.error(e);
  }
})();

async function putInDatabase(record) {
  try {
    await client.connect();
    database = client.db(databaseName);
    collection = database.collection(collectionName);

    let result = await collection.insertOne(record);
    console.log(`Inserted`);
  } catch (e) {
    console.error(e);
  }
}

/* INITIALIZE SEED SONGS */
seed_songs = new Map();
seed_songs.set("sad pop", "7qEHsqek33rTcFNT9PFqLf");          // Someone you loved; Lewis Capaldi
seed_songs.set("neutral pop", "3pHkh7d0lzM2AldUtz2x37");      // The Archer; Taylor Swift
seed_songs.set("happy pop", "4kbj5MwxO1bq9wjT5g9HaA");        // Shut up and dance; Walk the Moon
seed_songs.set("sad classic", "7nHvS6UUhz2gJhj8TIROLX");      // Adagio for Strings; Samuel Barber
seed_songs.set("neutral classic", "6kf7ZCJjEbjZXikivKOsvJ");  // Claire de Lune; Claude Debussy
seed_songs.set("happy classic", "5rk76Ugo6ZWsciJwvCQ4vH");    // Spring; Vivaldi
seed_songs.set("sad rock", "5Xak5fmy089t0FYmh3VJiY");         // Black; Pearl Jam
seed_songs.set("neutral rock", "5UWwZ5lm5PKu6eKsHAGxOk");     // Everlong; Foo Fighters
seed_songs.set("happy rock", "65OR4ywy8Cgs3FDHK82Idl");       // Higher Power; Cold Play
seed_songs.set("sad rap", "561jH07mF1jHuk7KlaeF0s");          // Mockingbird; Eminem
seed_songs.set("neutral rap", "7KXjTSCq5nL1LoYtL7XAwS");      // HUMBLE; Kendrick Lamar
seed_songs.set("happy rap", "4Nv8GzZWyZwjo08aoxDTv9");        // When We Party; Faith Evans (feat. Snoop Dogg)
seed_songs.set("sad jazz", "1wl5b2lw3YagQtZiYZbQWP");         // 'Round Midnight; Thelonious Monk
seed_songs.set("neutral jazz", "4vLYewWIvqHfKtJDk8c8tq");     // So What; Miles Davis
seed_songs.set("happy jazz", "5L8ta4ECl5zeA6bGqY7G38");       // Sing, sing, sing; Benny Goodman
seed_songs.set("sad funk", "2uMqG8w8oi09fB2YA2QLOm");         // Summer Madness; Kool & The Gang
seed_songs.set("neutral funk", "2x1LQq8lsUzAA2wNj8yjC9");     // Pick Up the Pieces; Average White Band
seed_songs.set("happy funk", "5XeSAezNDk9tuw3viiCbZ3");       // Get Up Offa That Thing; James Brown

user = "";

const craftRouter = require("./routes/route");
app.use("/", craftRouter);

app.get("/selectMood", (req, res) => {
  user = req.query.userId;
  userId = user;
  console.log(user);

  res.render("selectMood");
});

app.post("/suggestions", (req, res) => {

  /* CATEGORIZE MOOD BASED ON SLIDER */
  let mood = "";
  if (req.body.valence >= 0.66) {
    mood = "happy";
  } else if (req.body.valence >= 0.33) {
    mood = "neutral";
  } else {
    mood = "sad";
  }

  /* COMBINE MOOD WITH GENRE TO GET SEED SONG */
  const song_type = mood + " " + req.body.genre;
  const seed_song = seed_songs.get(song_type);
  console.log(song_type);

  /* CONSTRUCT REQUEST */
  const config = {
    method: "get",
    maxBodyLength: Infinity,
    url: `https://api.reccobeats.com/v1/track/recommendation?size=100&seeds=${seed_song}&danceability=${req.body.danceability}&instrumentalness=${req.body.instrumentalness}&loudness=${req.body.loudness}&valence=${req.body.valence}`,
    headers: {
      Accept: "application/json",
    },
  };

  /* SEND REQUEST */
  axios
    .request(config)
    .then((response) => {
      /*******************************************************************
      RECCOBEATS API OFTEN PROVIDES SONGS WITH VERY FEW LISTENS.
      SO, WE REQUEST 100 SONGS, SORT BY POPULARITY, AND CHOOSE RANDOMLY
      AMONG THE TOP 3 MOST POPULAR SONGS TO RECOMMEND 
      *******************************************************************/
      const songs = response.data.content;
      songs.sort((a, b) => b.popularity - a.popularity);
      const songRecs = songs.slice(0, 3);

      /* CREATE TABLE */
      let reccomendationsTable = `
      <table border="1">
        <tr>
          <th>Song</th>
          <th>Artist</th>
        </tr>`;

      let cleanedSongRecs = Array(songRecs.length);
      let i = 0;

      /* FILL IN TABLE WITH SONG RECS */
      for (const song of songRecs) {
        let Artists = song.artists
          .reduce((acc, e) => {
            return acc + e.name + ", ";
          }, "")
          .trim()
          .slice(0, -1); // Remove space and get rid of extra comma
        cleanedSongRecs[i++] = {
          song: song.trackTitle,
          artists: Artists,
          href: song.href
        };
        reccomendationsTable += `<tr><td><a href="${song.href}">${song.trackTitle}</a></td><td>${Artists}</td></tr>`;
      }
      reccomendationsTable += `</table>`;

     /* CREATING OBJECT TO STORE IN DB */
      let toLog = {
        userId: userId,
        songRecs: cleanedSongRecs,
        createdAt: new Date().toLocaleDateString(),
      };
      putInDatabase(toLog);

      /* RENDER TEMPLATE */
      res.render("suggestions", { reccomendationsTable });
    })
    .catch((error) => {
      res.render("selectMood", {error: "Sorry, no songs matched that set of moods. You must be feeling wild! Try again with another combination of values!"});
    });
});
app.get("/history", async (req, res) => {
  /***************************/
  //Retrieve record related to user
  /***************************/
  const cursor = collection.find({ userId: userId });
  result = await cursor.toArray();
  let records = result.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  //console.log(records)

  let historyTable = `
      <table border="1">
        <tr>
          <th>Song</th>
          <th>Artist</th>
          <th>Date</th>
        </tr>`;

  for (entry of records) {
    for (rec of entry.songRecs) {
      historyTable += `<tr><td><a href="${rec.href}">${rec.song}</a></td><td>${rec.artists}</td><td>${entry.createdAt}</td></tr>`;
    }
  }
  historyTable += `</table>`;

  res.render("history", { historyTable });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});
