const getDeezerAuthorizationUrl = (clientId, redirectUri) =>
  `https://connect.deezer.com/oauth/auth.php?app_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&perms=basic_access,manage_library,email`;

const extractUrlParameter = (name) => {
  const regex = new RegExp(`[\\?&]${name}=([^&#]*)`);
  const match = regex.exec(window.location.search);
  return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
};

const fetchLastFmData = async (endpoint, params = {}) => {
  const url = `https://ws.audioscrobbler.com/2.0/?method=${endpoint}&user=${LAST_FM_USERNAME}&api_key=${LAST_FM_API_KEY}&format=json&${new URLSearchParams(
    params
  )}`;

  const response = await fetchJsonp(url);
  if (!response.ok)
    throw new Error(
      `Failed to fetch data from LastFM. Status: ${response.status}`
    );

  return response.json();
};

const fetchDeezerTrackId = async (songName, artistName, accessToken) => {
  const query = `${songName} ${artistName}`;
  const response = await fetchJsonp(
    `https://api.deezer.com/search?q=${encodeURIComponent(
      query
    )}&limit=1&type=track`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = await response.json();
  if (!data.data?.length)
    throw new Error(
      `Track "${songName}" by ${artistName} not found on Deezer.`
    );

  return data.data[0].id;
};

const createAndAddToDeezerPlaylist = async (trackIds, accessToken) => {
  const response = await fetchJsonp(
    `https://api.deezer.com/user/${DEEZER_USER_ID}/playlists`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "My New Playlist",
        description: "This playlist was created using the Deezer API.",
      }),
    }
  );

  const playlistData = await response.json();
  const playlistId = playlistData.id;

  const addTracksResponse = await fetchJsonp(
    `https://api.deezer.com/playlist/${playlistId}/tracks`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        songs: trackIds,
      }),
    }
  );

  return addTracksResponse.json();
};

const processUrlParameters = async () => {
  const code = extractUrlParameter("code");

  if (code) {
    const deezerAccessToken = code;

    try {
      const { toptracks: { track: tracksInfo = [] } = {} } =
        await fetchLastFmData("user.gettoptracks", {
          limit: 100,
          period: "12month",
        });
      if (!tracksInfo.length)
        throw new Error("Invalid top tracks data from LastFM.");

      const deezerTrackIds = await Promise.all(
        tracksInfo.map((track) =>
          fetchDeezerTrackId(track.name, track.artist.name, deezerAccessToken)
        )
      );

      for (let i = 0; i < deezerTrackIds.length; i += 50) {
        await new Promise((resolve) => setTimeout(resolve, 6000));
      }

      const result = await createAndAddToDeezerPlaylist(
        deezerTrackIds,
        deezerAccessToken
      );
      console.log("Successfully created Deezer playlist:", result);
    } catch (error) {
      console.error("Error occurred during processing:", error.message);
    }
  } else {
    window.location.href = getDeezerAuthorizationUrl(
      DEEZER_CLIENT_ID,
      DEEZER_REDIRECT_URI
    );
  }
};

processUrlParameters();
