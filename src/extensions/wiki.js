const rp = require('request-promise-native');
const PromisePool = require('es6-promise-pool');
const moment = require('moment');
const fs = require('fs');
const shortid = require('shortid');

const BASE_URL = "https://en.wikipedia.org/api/rest_v1/page/html/";

/** Remove any text between parenthesis and turn any extra whitespace into a regular space */
function sanitize(string) {
  return string.replace(/\s*\[.*?\]\s*/g, "").replace(/\s+/g, " ");
}

function getLeafNodes(rootNode) {
  if (rootNode.childNodes.length > 0) {
    const children = [];
    for (let i = 0; i < rootNode.childNodes.length; i++) {
      children.push(...getLeafNodes(rootNode.childNodes[i]));
    }
    return children;
  }
  return [rootNode];
}

function getYear(rootNode) {
  const released = rootNode.textContent;
  let str = sanitize(released);
  if (str.indexOf("(") > 0) {
    str = str.slice(0, str.indexOf("("));
  }
  const time = moment(str);
  return time.year()
}

function getGenres(rootNode) {
  const leafNodes = getLeafNodes(rootNode);
  // filter out ", ", " ", ".", and any other weird symbols that might be accidental
  const textNodes = leafNodes.filter((node) => node.textContent && node.textContent.length > 2);
  const text = textNodes.map((node) => sanitize(node.textContent))
  return text.map((genre) => formatGenre(genre)).filter(Boolean);

}

function capitalize(word) {
  if (word === "and") {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function formatGenre(genre) {
  genre = genre.trim().split(' ').map((word) => capitalize(word)).join(' ');
  return genre.split('-').map((word) => capitalize(word)).join('-');
}

function getAllWikiOptions(album, artist) {
  const albumName = album.name.replace(/ /g, "_");
  const artistName = artist.name.replace(/ /g, "_");
  return [
    BASE_URL + albumName,
    BASE_URL + albumName + "_(album)",
    BASE_URL + albumName + "_(" + artistName + "_album)",
    BASE_URL + albumName + "_(EP)",
    BASE_URL + albumName + "_(mixtape)",
    BASE_URL + albumName + "_(song)",
    BASE_URL + albumName + "_(" + artistName + "_song)",
    BASE_URL + albumName + "_(" + artistName + "_mixtape)",
    BASE_URL + albumName + "_(" + artistName + "_EP)"
  ];
}

async function findAsync(arr, asyncCallback) {
  const promises = arr.map(asyncCallback);
  const results = await Promise.all(promises);
  const index = results.findIndex(result => result);
  return arr[index];
}

function isRightLink(link, album, artist) {
  return rp(link).then((htmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const infoBoxes = doc.getElementsByClassName('infobox');
    const infoBox = infoBoxes[0];
    return infoBox && infoBox.textContent.toLowerCase().includes("by " + artist.name.toLowerCase());
  }).catch((err) => {
    return false;
  });
}

async function searchForWikiPage(album, library) {
  const artist = library.getArtistsByIds(album.artistIds)[0];
  const options = getAllWikiOptions(album, artist);
  const correct = findAsync(options, async (option) => {
    return await isRightLink(option, album, artist);
  });
  return correct;
}

async function modifyAlbum(album, library) {
  if (!album.wikiPage) {
    album.wikiPage = await searchForWikiPage(album, library);
  }
  if (album.wikiPage) {
    //console.log("Modifying: " + album.name);
    return rp(album.wikiPage).then((htmlString) => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const infoBoxes = doc.getElementsByClassName('infobox');
        const infoBox = infoBoxes[0];
        const rows = infoBox.getElementsByTagName('tr');
        for (const row of rows) {
          try {
            const headers = row.getElementsByTagName('th');
            const name = headers[0] && headers[0].textContent;
            const data = row.getElementsByTagName('td')[0];
            switch (name) {
              case 'Genre':
                const genres = getGenres(data);
                album.genreIds = library.getGenreIds(genres);
                break;
              case 'Released':
                album.year = getYear(data);
                break;
              default:
                break;
            }
          } catch (err) {
            console.log("GOT ERR:");
            console.log(err);
          }
        }

        const pics = infoBox.getElementsByTagName('img');
        //TODO: take multiple pictures (rotate them elsewhere in the app)
        const pic = pics[0];
        const options = {
          url: pic.src,
          encoding: 'binary',
        }
        return rp(options).then((data) => {
          if (!album.albumArtFile) {
            const id = shortid.generate()
            album.albumArtFile = './data/' + id + '.png';
          }
          fs.writeFile(album.albumArtFile, data, 'binary', (err) => err ? console.log(err) : "");
        });

      } catch (err) {
        // TODO: add error to album on each error -- make each error different / possible all at once
        console.log(err);
      }
    }).catch((err) => {
        // TODO: add error to album for no wiki page
    });
  } else {
    console.log("Failed to find wiki page for: " + album.name);
    return Promise.resolve();
  }
}

export function runWikiExtension(library) {
  console.log('running wiki');
  console.log(library);

  const albums = library.getAlbums()
  let index = 0;
  var producer = () => {
    const album = albums[index];
    index++;
    if (!album) {
      return null
    } else {
      return modifyAlbum(album, library);
    }
  };
  // set up debug mode -- 1 when in debug, then either const or some func based on comp/network
  const pool = new PromisePool(producer, /* numConcurrent= */ 1);
  return pool.start().then(() => {
    console.log('done');
  });
}
