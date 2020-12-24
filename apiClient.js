import axios from "axios";

const instance = axios.create({
  timeout: 30000,
});

export async function get(url) {
  try {
    const response = await instance.get(
        url
    );
    return response.data;
  } catch(e) {
    console.log(`Error retrieving data from ${url}`)
  }
}