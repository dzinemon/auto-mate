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
        const desc = e.snippet.description.replace(/\s+/g, ' ').substring(0, 300).replace(/https:\S*/mg, '').replace(/"/g, '').split('. ')[0].split('? ')[0].replace(/[(|)]/g, '').replace(e.snippet.title, '').trim();
        e.snippet.description = desc
        delete e.etag
        delete e.kind
        delete e.snippet.tags
        delete e.snippet.channelId
        delete e.snippet.localized
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
  console.log(response)
  fs.writeFileSync(path, JSON.stringify(response, null, 2));

  return response
};

(async () => {
  try {

    const response =  await createSnippetJson({ path: dest });


    const token = core.getInput('token');
    const owner = core.getInput('owner');
    const repo = core.getInput('repo');
    const octokit = github.getOctokit(token);
    const message = "updated snippet json";
    const { data: user } = await octokit.users.getAuthenticated();

    console.log(user);
    console.log(owner);
    

    const files = [
      {
        name: "_data/youtube.json",
        contents: response
      },
    ];

    const commitableFiles = files.map(({name, contents}) => {
      return {
        path: name,
        mode: '100644',
        type: 'commit',
        content: contents
      }
    })

    // await octokit.rest.git.createCommit({
    //   owner,
    //   repo,
    //   message,
    //   tree: commitableFiles,
    //   author.name,
    //   author.email
    // })

    
    core.setOutput("response", response);
    
    return response
  } catch (err) {
    console.error(err);
    core.setFailed(err.message);
  }
})();