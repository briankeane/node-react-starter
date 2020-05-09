const { assert } = require('chai');
const lib = require('./spotify.lib');
const db = require('../../../db');
const spotifyAPI = require('../api');
const sinon = require('sinon');
const {
  api_get_me_200,
  api_get_me_recently_played_200,
  api_get_me_top_tracks_200,
  api_get_me_saved_tracks_200,
  api_get_me_saved_tracks_final_chunk_200
} = require('../../../testHelpers/spotify/mockResponses');
const { 
  createSpotifyUser, 
  createTracks,
  formatLikeGetTopTracks,
  formatLikeGetSavedTracks
} = require('../../../testHelpers/spotify/helpers');
const {
  clearDatabase
} = require('../../../testHelpers/testUtils');


describe ('Spotify Library functions', function () {
  var getMeStub;
  const accessToken = 'asdfafsd';
  const refreshToken = 'qewrqwer';

  describe('createUserAndSpotifyUser', function () {
    before(async function () {
      await clearDatabase(db);
    });

    beforeEach(function () {
      getMeStub = sinon.stub(spotifyAPI, 'getMe').resolves(api_get_me_200);
    });

    afterEach(async function () {
      getMeStub.restore();
      await clearDatabase(db);
    });

    it ('creates a SpotifyUser and a User from accessToken and refreshToken', async function () {
      var { spotifyUser, user } = await lib.createSpotifyUserAndUser({ accessToken, refreshToken });
      assert.equal(spotifyUser.accessToken, accessToken);
      assert.equal(spotifyUser.refreshToken, refreshToken);
      assert.equal(spotifyUser.spotifyUID, api_get_me_200['id']);
      assert.equal(user.displayName, api_get_me_200['display_name']);
      assert.equal(user.email, api_get_me_200['email']);
      assert.equal(user.profileImageURL, api_get_me_200['images'][0]['url']);
    });

    it ('creates a SpotifyUser and a User from only a refreshToken', async function () {
      var { spotifyUser, user } = await lib.createSpotifyUserAndUser({ refreshToken });
      assert.notOk(spotifyUser.accessToken);
      assert.equal(spotifyUser.refreshToken, refreshToken);
      assert.equal(spotifyUser.spotifyUID, api_get_me_200['id']);
      assert.equal(user.displayName, api_get_me_200['display_name']);
      assert.equal(user.email, api_get_me_200['email']);
      assert.equal(user.profileImageURL, api_get_me_200['images'][0]['url']);
    });

    it ('creates a SpotifyUser from only a refreshToken', async function () {
      var { spotifyUser, user } = await lib.createSpotifyUserAndUser({ accessToken, refreshToken });
      assert.equal(spotifyUser.accessToken, accessToken);
      assert.equal(spotifyUser.refreshToken, refreshToken);
      assert.equal(spotifyUser.spotifyUID, api_get_me_200['id']);
      assert.equal(user.displayName, api_get_me_200['display_name']);
      assert.equal(user.email, api_get_me_200['email']);
      assert.equal(user.profileImageURL, api_get_me_200['images'][0]['url']);
    });

    it ('only updates the accessToken if the SpotifyUser already exists', async function () {
      createSpotifyUser(db, { refreshToken, accessToken: 'oldAccessToken' });
      var { spotifyUser } = await lib.createSpotifyUserAndUser({ accessToken, refreshToken });
      assert.equal(spotifyUser.accessToken, accessToken);
      assert.equal(spotifyUser.refreshToken, refreshToken);
    });    
  });

  describe('get UserProfileSeed', function () {
    beforeEach(function () {
      getMeStub = sinon.stub(spotifyAPI, 'getMe').resolves(api_get_me_200);
    });

    afterEach(function () {
      getMeStub.restore();
    });

    it ('gets a properly formatted PlayolaUserProfile', async function () {
      const seed = await lib.getPlayolaUserSeed({ accessToken, refreshToken });
      assert.equal(seed.displayName, api_get_me_200.display_name);
      assert.equal(seed.email, api_get_me_200.email);
      assert.equal(seed.profileImageURL, api_get_me_200.images[0].url);
      sinon.assert.calledWith(getMeStub, { accessToken, refreshToken });
    });

    it ('gracefully handles no images in seed', async function () {
      const getMeResponseWithoutImages = Object.assign({}, api_get_me_200);
      getMeResponseWithoutImages['images'] = undefined;
      getMeStub.resolves(getMeResponseWithoutImages);
      const seed = await lib.getPlayolaUserSeed({ accessToken, refreshToken });
      assert.equal(seed.displayName, api_get_me_200.display_name);
      assert.equal(seed.email, api_get_me_200.email);
      assert.isUndefined(seed.profileImageURL);
    });

    it ('gracefully handles no images.length in seed', async function () {
      const getMeResponseWithoutImages = Object.assign({}, api_get_me_200);
      getMeResponseWithoutImages.images = [];
      getMeStub.resolves(getMeResponseWithoutImages);
      const seed = await lib.getPlayolaUserSeed({ accessToken, refreshToken });
      assert.equal(seed.displayName, api_get_me_200.display_name);
      assert.equal(seed.email, api_get_me_200.email);
      assert.isUndefined(seed.profileImageURL);
    });
  });

  describe('getUserRecentlyPlayed', function () {
    var getRecentlyPlayedStub, getUsersTopTracksStub, spotifyUser;

    beforeEach(async function () {
      getRecentlyPlayedStub = sinon.stub(spotifyAPI, 'getRecentlyPlayedTracks').resolves(api_get_me_recently_played_200);
      getUsersTopTracksStub = sinon.stub(spotifyAPI, 'getUsersTopTracks').resolves(api_get_me_top_tracks_200);
      spotifyUser = await createSpotifyUser(db);
    });

    afterEach(function () {
      getRecentlyPlayedStub.restore();
      getUsersTopTracksStub.restore();
    });

    it ('gets recently played tracks', async function () {
      const tracks = await lib.getRecentlyPlayedTracks({ userID: spotifyUser.userID });
      assert.deepEqual(tracks, api_get_me_recently_played_200['items'].map(item => item.track));
      sinon.assert.calledWith(getRecentlyPlayedStub, { accessToken: spotifyUser.accessToken, 
        refreshToken: spotifyUser.refreshToken });
    });

    it ('gets users top tracks', async function () {
      const tracks = await lib.getUsersTopTracks({ userID: spotifyUser.userID });
      assert.deepEqual(tracks, api_get_me_top_tracks_200['items']);
      sinon.assert.calledWith(getUsersTopTracksStub, { 
        accessToken: spotifyUser.accessToken, 
        refreshToken: spotifyUser.refreshToken 
      });
    });
  });

  describe('getUserSavedTracks', function () {
    var getUserSavedTracksStub, spotifyUser;
    beforeEach(async function () {
      getUserSavedTracksStub = sinon.stub(spotifyAPI, 'getUsersSavedTracks');
      getUserSavedTracksStub.onCall(0).resolves(api_get_me_saved_tracks_200);
      getUserSavedTracksStub.onCall(1).resolves(api_get_me_saved_tracks_final_chunk_200);
      spotifyUser = await createSpotifyUser(db);
    });

    afterEach(function () {
      getUserSavedTracksStub.restore();
    });

    it ('works even with pagination', async function () {
      const receivedTracksChunk1 = api_get_me_saved_tracks_200['items'].map(item => item.track);
      const receivedTracksChunk2 = api_get_me_saved_tracks_final_chunk_200['items'].map(item => item.track);
      const totalExpectedTracks = receivedTracksChunk1.concat(receivedTracksChunk2);
      const tracks = await lib.getUsersSavedTracks({ userID: spotifyUser.userID });
      assert.deepEqual(totalExpectedTracks, tracks);
      sinon.assert.calledWith(getUserSavedTracksStub.firstCall, {
        accessToken: spotifyUser.accessToken,
        refreshToken: spotifyUser.refreshToken,
        offset: 0
      });
      sinon.assert.calledWith(getUserSavedTracksStub.secondCall, {
        accessToken: spotifyUser.accessToken,
        refreshToken: spotifyUser.refreshToken,
        offset: 50
      });
    });
  });

  describe('getUserRelatedSongSeeds', function () {
    var totalInitialReceivedTracks, spotifyUser; 
    let libGetSavedTracksStub, libGetTopTracksStub, apiGetRecommendedTracksStub;

    beforeEach(async function () {
      this.timeout(5000);
      // tracks returned initially should have this makeup:
      totalInitialReceivedTracks = createTracks({ count: 36, desiredArtistIDCounts: { 'eight': 8, 'seven': 7, 'six': 6, 'five': 5, 'four': 4, 'three': 3, 'two': 2, 'one': 1} });
      libGetSavedTracksStub = sinon.stub(spotifyAPI, 'getUsersSavedTracks').resolves(formatLikeGetSavedTracks(totalInitialReceivedTracks.slice(0,5)));
      libGetTopTracksStub = sinon.stub(spotifyAPI, 'getUsersTopTracks').resolves(formatLikeGetTopTracks(totalInitialReceivedTracks.slice(3)));
      apiGetRecommendedTracksStub = sinon.stub(spotifyAPI, 'getRecommendedTracks').callsFake(() => { return { tracks: createTracks({ count: 10 }) }; });
      spotifyUser = await createSpotifyUser(db);
    });

    afterEach(function () {
      libGetTopTracksStub.restore();
      libGetSavedTracksStub.restore();
      apiGetRecommendedTracksStub.restore();
    });

    it ('works even if it has to pad with similar artists', async function () {
      const similarSongs = await lib.getUserRelatedSongSeeds({ userID: spotifyUser.userID, minimum: 50 });
      assert.equal(similarSongs.length, 56);
      sinon.assert.calledWith(apiGetRecommendedTracksStub.firstCall, { 
        seed_artists: ['eight','seven','six','five','four']
      });
      sinon.assert.calledWith(apiGetRecommendedTracksStub.secondCall, {
        seed_artists: ['six','five','four','three','two']
      });
    });
  });
});