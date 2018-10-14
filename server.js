require('dotenv').load({silent: true});
const express = require('express');
const nunjucks = require('nunjucks');
const app = express();
const port = process.env.PORT || 3000;
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});
const axios = require('axios');

pool.connect().then(client => {
    return client.query("CREATE TABLE IF NOT EXISTS mememash(id serial PRIMARY KEY, memeid varchar(255) NOT NULL, name varchar(255) NOT NULL, votes integer NOT NULL DEFAULT 0)")
        .then(res => {
            console.log('all good');
            client.release()
        })
        .catch(e => {
            console.log('error: '+e);
            client.release()
        })
});


const bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 


app.use(express.json());       // to support JSON-encoded bodies
app.use(express.urlencoded()); // to support URL-encoded bodies

nunjucks.configure('views', {
    autoescape: true,
    express: app
});

app.get('/', function (req, res) {
    let offset = Math.floor(Math.random() * 1000) + 1 ;
    axios.get('https://api.giphy.com/v1/gifs/search?fmt=json&limit=2&offset='+offset+'&rating=PG-13&q=memes&api_key='+process.env.GIPHY_API_KEY)
    .then(function (response) {
        let memes = [];
        for(meme in response.data.data){
            memes.push({img:response.data.data[meme].images.downsized_large.url, title:response.data.data[meme].title,id:response.data.data[meme].id});
        }
        res.render('home.html', { memes:memes});
    })
    .catch(function (error) {
      // handle error
      console.log(error);
      res.send("Error " + err);
    });

})

app.post('/vote/:giphyid', async (req, res) => {
    const data = req.body;
   
    const client = await pool.connect()
    let select = await client.query('select id from mememash where memeid = $1',[req.params.giphyid]);
    let results = (select) ? select.rows : null;
    client.release();

    if(!results.length){
        try {
            const client = await pool.connect()
            let insert = await client.query('INSERT INTO mememash(memeid, name, votes) values($1, $2, $3)',[req.params.giphyid, data.name, 1]);
            client.release();
        } catch (err) {
            console.error(err);
            res.send("Error " + err);
        }
    }else{

        try {
            const client = await pool.connect()
            let insert = await client.query('UPDATE mememash set votes=votes+1 where memeid = $1',[req.params.giphyid]);
            client.release();
        } catch (err) {
            console.error(err);
            res.send("Error " + err);
        }

    }

    let offset = Math.floor(Math.random() * 1000) + 1 ;
    axios.get('https://api.giphy.com/v1/gifs/'+req.params.giphyid+'?api_key='+process.env.GIPHY_API_KEY)
    .then(function (response) {
        let samememe = {img:response.data.data.images.downsized_large.url, title:response.data.data.title,id:response.data.data.id};
        axios.get('https://api.giphy.com/v1/gifs/search?fmt=json&limit=1&offset='+offset+'&rating=PG-13&q=memes&api_key='+process.env.GIPHY_API_KEY)
        .then(function (response) {
            let memes = [samememe];
            for(meme in response.data.data){
                memes.push({img:response.data.data[meme].images.downsized_large.url, title:response.data.data[meme].title,id:response.data.data[meme].id});
            }
            res.render('home.html', { memes:memes});
        })
        .catch(function (error) {
            console.log(error);
            res.send("Error " + err);
        });

    })
    .catch(function (error) {
        console.log(error);
        res.send("Error " + err);
    });

});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));