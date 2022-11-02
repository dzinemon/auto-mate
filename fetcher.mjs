import fs from "fs";
import fetch from "node-fetch";
import yaml from "js-yaml";
import dotenv from 'dotenv';
import core from '@actions/core';
import github from '@actions/github';
dotenv.config()
// console.log(process.env)


// YT_API_KEY
const apiKey = process.env.YT_API_KEY;
var dest = process.env.DEST;
var source = process.env.SOURCE;

const requestOptions = {
  method: "GET",
  redirect: "follow",
};

const currentVideos = async () => {
  let fileContents = await fs.readFileSync(source, "utf8");
  let data = await yaml.load(fileContents);
  return data;
};

const fetchBatchSnippets = async ({ idString }) => {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${idString}&key=${apiKey}`;
  const response = await fetch(url, requestOptions)
    .then((response) => response.text())
    .then((result) => {
      const res = JSON.parse(result);
      const videoData = res.items
      .map(e => {
        const desc = e.snippet.description.replace(/"/g, '')
        // e.snippet.description = desc
        delete e.snippet.description
        delete e.etag
        delete e.kind
        delete e.snippet.tags
        delete e.snippet.localized
        e.snippet.desc = desc
        return e
      })
      .map((i) => {
        return { ...i, name: i.snippet.title };
      });
      return videoData;
    })
    .catch((error) => console.log("error", error));

  return response;
};

const fetchAllSnippets = async ({ ids }) => {
  var allIds = ids;
  console.log(`🚀 Total videos found ${allIds.length}`);
  var snippets = [];
  let res;
  while (allIds.length > 0) {
    var idString = allIds.splice(0, 50).join();
    res = await fetchBatchSnippets({ idString });
    snippets = snippets.concat(res);
  }

  // return JSON.stringify(snippets, null, 2);
  return snippets
};

const createSnippetJson = async ({ path }) => {
  const ids = await currentVideos();
  const response = await fetchAllSnippets({ ids });
  // console.log(response)
  fs.writeFileSync(path, JSON.stringify(response, null, 2));

  return response
};

(async () => {
  try {

    // fetch inputs for octokit
    const owner = core.getInput('owner', { required: true });
    const repo = core.getInput('repo', { required: true });
    const author = core.getInput('author', { required: true });
    const token = core.getInput('token', { required: true });
    const message = 'update youtube json';

    console.log(author);

    // create octokit instance 
    const octokit = new github.getOctokit(token);

    console.log(octokit)

    // octokit.rest.git.createCommit

    // await octokit.rest.git.createCommit({
    //   owner,
    //   repo,
    //   message,
    //   tree,
    //   author.name,
    //   author.email
    //   })
    
    const response =  await createSnippetJson({ path: dest });
  
    // console.log(`Type of response: ${typeof response}`);
    // console.log(response);

    
    core.setOutput("response", response);
    return response
  } catch (err) {
    console.error(err);
    core.setFailed(error.message);
  }
})();