const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const jwt = require("jsonwebtoken");
app.use(express.json());
const initiateDBInstance = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (err) {
    console.log(`DB Error:${err.message}`);
    process.exit(1);
  }
};
const givinFeed = (obj) => {
  return {
    username: obj.username,
    tweet: obj.tweet,
    dateTime: obj.date_time,
  };
};

initiateDBInstance();
const authenticate = (request, response, next) => {
  const headers = request.headers["authorization"];
  let token = "";
  if (headers !== undefined) {
    token = headers.split(" ")[1];
  }
  if (token !== undefined) {
    jwt.verify(token, "umar", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

//API 1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const checkQuery = `SELECT username FROM user where username='${username}';`;
  const checkResult = await db.get(checkQuery);
  if (checkResult === undefined) {
    if (password.length > 6) {
      const encryptedPassword = await bcrypt.hash(password, 10);
      const insertQuery = `INSERT INTO USER(username,password,name,gender) VALUES('${username}','${encryptedPassword}','${name}','${gender}');`;
      await db.run(insertQuery);
      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkQuery = `SELECT * FROM user where username='${username}';`;
  const checkResult = await db.get(checkQuery);
  if (checkResult !== undefined) {
    const isPasswordSame = await bcrypt.compare(password, checkResult.password);
    if (isPasswordSame === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "umar");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});
//API 3
app.get("/user/tweets/feed/", authenticate, async (request, response) => {
  const getUserIdQuery = `SELECT user_id from user where username='${request.username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const userId = getUserId.user_id;
  const combine = `select u.username,t.tweet,date_time from user u join follower f on u.user_id=f.following_user_id join tweet t on t.user_id=f.following_user_id where f.follower_user_id=${userId} order by date_time DESC LIMIT 4 OFFSET 0;`;
  const result = await db.all(combine);
  response.send(result.map((obj) => givinFeed(obj)));
});

//API 4
app.get("/user/following", authenticate, async (request, response) => {
  const getUserIdQuery = `SELECT user_id from user where username='${request.username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const userId = getUserId.user_id;
  const combine = `SELECT u.name from user u join follower f ON u.user_id = f.following_user_id  where f.follower_user_id=${userId} ;`;
  const result = await db.all(combine);
  response.send(result);
});

//API 5
app.get("/user/followers", authenticate, async (request, response) => {
  const getUserIdQuery = `SELECT user_id from user where username='${request.username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const userId = getUserId.user_id;
  const combine = `SELECT name from user u join follower f where u.user_id=f.follower_user_id AND f.following_user_id=${userId};`;
  const result = await db.all(combine);
  response.send(result);
});

//API 6
app.get("/tweets/:tweetId/", authenticate, async (request, response) => {
  const { tweetId } = request.params;
  const gettingTweetUserIdQuery = `SELECT user_id from tweet where tweet_id=${tweetId};`;
  const tweetedUser = await db.get(gettingTweetUserIdQuery);
  const getUserIdQuery = `SELECT user_id from user where username='${request.username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const userId = getUserId.user_id;
  const gettingFollowingQuery = `SELECT following_user_id from follower where follower_user_id=${userId};`;
  const followingIds = await db.all(gettingFollowingQuery);
  const followingArray = followingIds.map((obj) => {
    return obj.following_user_id;
  });
  if (followingArray.includes(tweetedUser.user_id)) {
    const getTweet = `SELECT t.tweet,COUNT(distinct l.like_id) likes,COUNT(distinct r.reply_id) replies,date_time dateTime FROM tweet t LEFT  JOIN reply r ON t.tweet_id=r.tweet_id left JOIN like l on t.tweet_id=l.tweet_id where t.tweet_id=${tweetId};`;
    const result = await db.get(getTweet);
    response.send(result);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//API 7
app.get("/tweets/:tweetId/likes/", authenticate, async (request, response) => {
  const { tweetId } = request.params;
  const gettingTweetUserIdQuery = `SELECT user_id from tweet where tweet_id=${tweetId};`;
  const tweetedUser = await db.get(gettingTweetUserIdQuery);
  const getUserIdQuery = `SELECT user_id from user where username='${request.username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const userId = getUserId.user_id;
  const gettingFollowingQuery = `SELECT following_user_id from follower where follower_user_id=${userId};`;
  const followingIds = await db.all(gettingFollowingQuery);
  const followingArray = followingIds.map((obj) => {
    return obj.following_user_id;
  });
  if (followingArray.includes(tweetedUser.user_id)) {
    const getTweet = `SELECT distinct user.username username FROM user JOIN like ON USER.USER_ID=LIKE.USER_ID where like.tweet_id=${tweetId};`;
    const result = await db.all(getTweet);
    const resultArray = result.map((obj) => {
      return obj.username;
    });
    response.send({ likes: resultArray });
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//API 8
app.get(
  "/tweets/:tweetId/replies/",
  authenticate,
  async (request, response) => {
    const { tweetId } = request.params;
    const gettingTweetUserIdQuery = `SELECT user_id from tweet where tweet_id=${tweetId};`;
    const tweetedUser = await db.get(gettingTweetUserIdQuery);
    const getUserIdQuery = `SELECT user_id from user where username='${request.username}';`;
    const getUserId = await db.get(getUserIdQuery);
    const userId = getUserId.user_id;
    const gettingFollowingQuery = `SELECT following_user_id from follower where follower_user_id=${userId};`;
    const followingIds = await db.all(gettingFollowingQuery);
    const followingArray = followingIds.map((obj) => {
      return obj.following_user_id;
    });

    if (followingArray.includes(tweetedUser.user_id)) {
      const getTweet = `SELECT  u.username name,r.reply reply FROM reply r JOIN user u ON r.user_id = u.user_id join tweet t on t.user_id=${tweetedUser.user_id}  GROUP BY r.tweet_id ORDER BY r.date_time ;`;
      const result = await db.all(getTweet);
      response.send({ replies: result });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
//API 9
app.get("/user/tweets/", authenticate, async (request, response) => {
  const getUserIdQuery = `SELECT user_id from user where username='${request.username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const userId = getUserId.user_id;
  const query = ` SELECT  tweet,COUNT(distinct l.like_id) likes,COUNT(distinct r.reply_id) replies,date_time dateTime FROM tweet t left join like l on t.tweet_id=l.tweet_id left join reply r on t.tweet_id=r.tweet_id where t.user_id=${userId} GROUP BY t.tweet_id;`;
  const result = await db.all(query);
  response.send(result);
});

//API 10

app.post("/user/tweets", authenticate, async (request, response) => {
  const { tweet } = request.body;
  const getUserIdQuery = `SELECT user_id from user where username='${request.username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const userId = getUserId.user_id;
  const query = `INSERT INTO tweet(tweet,user_id,date_time) VALUES('${tweet}',${userId},DATETIME('now'));`;
  await db.run(query);
  response.send("Created a Tweet");
});

//API 11
app.delete("/tweets/:tweetId", authenticate, async (request, response) => {
  const { tweetId } = request.params;
  const query = `SELECT user_id from tweet where tweet_id=${tweetId};`;
  const getUserIdQuery = `SELECT user_id from user where username='${request.username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const userId = getUserId.user_id;
  const getUser = await db.get(query);
  if (getUser.user_id === userId) {
    const deleteQuery = `DELETE FROM tweet WHERE tweet_id=${tweetId};`;
    await db.run(deleteQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
