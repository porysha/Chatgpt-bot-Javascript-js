import { ChatGPTAPI } from "chatgpt";
import { Telegraf } from "telegraf";
import { createConnection } from "mysql";
import { Configuration, OpenAIApi } from "openai";
import Axios from "axios";
import { oraPromise } from "ora";
import fs from "fs";
import { fileURLToPath } from "url";

const telegram_bot_token = "bot token";
const openai_token = "api key";
// const apiKeySummery = "summery key"; //if you need add this
const adminIds = [79969644, 789012]; // آیدی عددی ادمین‌ها
const channels = ["@abcd", "@efg"];

const bot = new Telegraf(telegram_bot_token);
const api = new ChatGPTAPI({
  apiKey: openai_token,
});
// ==========================================DATABASE===========================================
const dbname = "chatgpt";
const db = createConnection({
  host: "localhost",
  user: "root",
  database: dbname,
  password: "",
});
db.query(`CREATE DATABASE IF NOT EXISTS ${dbname}`);
db.connect(function (err) {
  db.query(
    "CREATE TABLE IF NOT EXISTS users (" +
      "id INT AUTO_INCREMENT PRIMARY KEY," +
      "chat_id varchar(30)," +
      "first_name varchar(500) default null," +
      "last_name varchar(255) default null," +
      "username varchar(255) default null" +
      ")"
  );
});
function createIfUserDoesNotRegistered(message) {
  db.query(
    `SELECT EXISTS(SELECT * FROM users where chat_id='${message.chat.id}') as has`,
    (err, result) => {
      if (!result[0].has) {
        let username =
          typeof message.from.username === "undefined"
            ? ""
            : message.from.username;
        db.query(
          `insert into users (first_name,last_name,username,chat_id) values ('${message.from.first_name}','${message.from.last_name}','${username}','${message.chat.id}')`
        );
      }
    }
  );
}
// =======================================text===============================================
async function ask(msg, userId) {
  // send a message and wait for the response

  let res;

  let filename = `data/${userId}/promise.txt`;
  if (!fs.existsSync(filename)) {
    if (!fs.existsSync(`data/${userId}`)) {
      fs.mkdirSync(`data/${userId}`);
    }
    fs.writeFileSync(filename, "");
  }
  console.log("kir");

  const promiseId = fs.readFileSync(filename).toString();
  if (promiseId != "") {
    console.log(promiseId);
    res = await api.sendMessage(msg, {
      // conversationID:msg.id,
      parentMessageId: promiseId,
    });
    // dada ye vaghfe ham tonesi bendaz bein dakhasta boooos behet
  } else {
    console.log("i runned");
    res = await api.sendMessage(msg);
  }

  fs.writeFileSync(filename, res.id);
  console.log(res.id);

  return res.text;
}

// console.log(await ask('can you expand on that?','123'))

// process.exit(0)

// ================================START BTN============================================
bot.command("start", async (ctx) => {
  createIfUserDoesNotRegistered(ctx.message);
  await ctx
    .reply("سلام به خوش اومدی . از الان میتونی با من چت کنی .")
    .catch((e) => console.log("err8"));
});
// =========================================Panel=======================================؟
bot.command("panel", (ctx) => {
  if (adminIds.includes(ctx.from.id)) {
    ctx.reply("به پنل ادمین خوش امدی");
    // نمایش دکمه‌های پنل مدیریت به ادمین
    ctx.reply("پنل ادمبن", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "امارکاربران", callback_data: "users_stats" },
            { text: "Join Required Channels", callback_data: "join_channels" },
          ],
        ],
      },
    });
  } else {
    ctx.reply("You are not authorized to access this panel!");
  }
});
// پردازش دکمه‌های پنل مدیریت
bot.action("users_stats", (ctx) => {
  if (adminIds.includes(ctx.from.id)) {
    db.query(
      "SELECT COUNT(*) as user_count FROM users",
      (error, results, fields) => {
        if (error) throw error;
        const userCount = results[0].user_count;
        ctx.answerCbQuery(`امار فعلی ربات: ${userCount}`);
      }
    );
  } else {
    ctx.answerCbQuery("You are not authorized to access this panel!");
  }
});
// bot.action('join_channels', (ctx) => {
//   if (adminIds.includes(ctx.from.id))}
// =================================Translate===============================================================
const tren = async (text) => {
  let translate = await fetch(
    `  https://api.codebazan.ir/translate/?type=json&from=fa&to=en&text=${encodeURIComponent(
      text
    )}`
  );
  return JSON.parse(await translate.text()).result;
};
// const trfa = async text => {
// // let newtext =await text.replace(/[!?\.]/g, "")
// // console.log(newtext);
//   let translate = await fetch(`https://api.codebazan.ir/translate/?type=json&from=en&to=fa&text=${encodeURIComponent(text)}`)
//   return JSON.parse(await translate.text()).result
// }
let text;
// =================================img=========================================================
bot.command("img", async (ctx) => {
  try {
    for (const channel of channels) {
      let joinStatus = await bot.telegram.getChatMember(
        channel,
        ctx.message.chat.id
      );
      if (joinStatus.status == "left") {
        ctx
          .reply(
            ` برای استفاده از ربات باید عضو کانال ما شوید: ${channels.join(
              ", "
            )}`
          )
          .catch((e) => console.log("err7"));
        return;
      }
    }
    text = ctx.message.text;
    let translatedText = await tr(text);
    let response2 = await askImg(translatedText); //img
    if (
      response2 &&
      response2.data &&
      response2.data.data &&
      response2.data.data[0] &&
      response2.data.data[0].url
    ) {
      ctx
        .replyWithPhoto(response2.data.data[0].url)
        .catch((e) => console.log("err1"));
    } else {
      ctx
        .reply("متأسفانه، نمی‌توانیم عکس مورد نظر شما را پیدا کنیم.")
        .catch((e) => console.log("err2"));
    }
  } catch (err) {
    console.error(
      "An error occurred while communicating with ChatGPT API:",
      err
    );
    ctx
      .reply(
        "مشکلی در برقراری ارتباط با سرور به وجود آمده است. لطفا دوباره تلاش کنید."
      )
      .catch((e) => console.log("err3"));
  }
});

// ====================================TextChat======================================================
async function  handleMessage(ctx) {
  for (const channel of channels) {
    bot.telegram
      .getChatMember(channel, ctx.message.chat.id)
      .then((joinStatus) => {
        if (joinStatus.status == "left") {
          ctx
            .reply(
              ` برای استفاده از ربات باید عضو کانال ما شوید: ${channels.join(
                ", "
              )}`
            )
            .catch((e) => console.log("err4"));
          return;
        }
      })
      .catch((e) => console.log("err6"));
  }
  let text = ctx.message.text;
  // let newtext =await tren(text);
    ask(text, ctx.message.chat.id)
    .then((response) => {
      ctx.reply(`${response}`).catch((e) => console.log("err5"));
    })
    .catch((e) => console.log("err3"));
}

// =============================chat START / END====================================================

bot.command("startchat", async (ctx) => {
  fs.writeFile(`${ctx.message.chat.id}.txt`, "on", (err) => {
    if (err) throw err;
    ctx.reply("چت شما شروع شده است. هر پیام خود را ارسال کنید.");
  });

  bot.on("message", async (ctx) => {
    fs.readFile(`${ctx.message.chat.id}.txt`, (err, data) => {
      if (err) {
        console.error(err);
        return;
      }
      if (data.toString() === "on") {
      setTimeout(handleMessage(ctx),1000 *)  
      }
    });
  });
});

bot.command("endchat", async (ctx) => {
  fs.writeFile(`${ctx.message.chat.id}.txt`, "off", (err) => {
    if (err) throw err;
    ctx.reply("چت شما پایان رسیده ..");
  });
});

// =================================================================================================
bot.launch().catch((e) => {
  "e";
});


















// =============================================Imager====================================
// async function askImg(msg) {
//   try {
//     const configuration = new Configuration({
//       apiKey: openai_token,
//     });
//     const openai = new OpenAIApi(configuration);
//     const result = await openai.createImage({
//       prompt: msg,
//       n: 2,
//       size: "1024x1024",
//     });
//     return result;
//   } catch (err) {
//     console.error(
//       "An error occurred while communicating with ChatGPT API:",
//       err
//     );
//     return "متأسفانه، نمی‌توانیم عکس مورد نظر شما را پیدا کنیم.";
//   }
// }



// bot.on('message', async (ctx) => {
//     for (const channel of channels){
//         let joinStatus = await bot.telegram.getChatMember(channel, ctx.message.chat.id);
//         if (joinStatus.status == 'left'){
//             ctx.reply(` برای استفاده از ربات باید عضو کانال ما شوید: ${channels.join(', ')}`).catch(e=>console.log('err4'));
//             return;
//         }}
// text = ctx.message.text
// let textTr =await tren(text)
// let response = await ask(`${textTr}`)  //texten
// ctx.reply(`text1 : ${response}`).catch(e=>console.log('err5'));
//   });

// ==================================startchat========================================================

// export const psychologist = (instance: ChatGPTAPI) => {
//   const prompt = `I want you to act a psychologist. i will provide you my thoughts. I want you to  give me scientific suggestions that will make me feel better. my first thought, { typing here your thought, if you explain in more detail, i think you will get a more accurate answer. }`;
//   return {
//     psychologist: async (message: string): Promise<ChatMessage> => createPromptFactory(instance, prompt)(message),
//   };
// };

// export const muslimImam = (instance: ChatGPTAPI) => {
//   const prompt = `Act as a Muslim imam who gives me guidance and advice on how to deal with life problems. Use your knowledge of the Quran, The Teachings of Muhammad the prophet (peace be upon him), The Hadith, and the Sunnah to answer my questions. Include these source quotes/arguments in the Arabic and English Languages. My first request is: “How to become a better Muslim”?`;
//   return {
//     muslimImam: async (message: string): Promise<ChatMessage> => createPromptFactory(instance, prompt)(message),
//   };
// };

// export const friend = (instance: ChatGPTAPI) => {
//   const prompt = `I want you to act as my friend. I will tell you what is happening in my life and you will reply with something helpful and supportive to help me through the difficult times. Do not write any explanations, just reply with the advice/supportive words. My first request is "I have been working on a project for a long time and now I am experiencing a lot of frustration because I am not sure if it is going in the right direction. Please help me stay positive and focus on the important things."`;
//   return {
//     friend: async (message: string): Promise<ChatMessage> => createPromptFactory(instance, prompt)(message),
//   };
// };
// =======================================SUMMERY================================================
// const Summery = async (text) => {
//   const config = {
//     method: "POST",
//     url: "https://api.oneai.com/api/v0/pipeline",
//     headers: {
//       "api-key": apiKeySummery,
//       "Content-Type": "application/json",
//     },
//     data: {
//       input:text,
//       input_type: "article",
//       output_type: "json",
//       multilingual: {
//         enabled: true,
//       },
//       steps: [
//         {
//           skill: "summarize",
//         },
//       ],
//     },
//   };

//   try {
//     const response = await Axios(config);
//     return response.data
//   } catch (error) {
//     console.log(error);
//   }
// };
