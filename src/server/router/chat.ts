import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createRouter } from "./context";

import { readCSV } from "@/utils/helper";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import axios from "axios";
import {
  chatCall,
  chatCallJsonMode,
  chatCallWithContext,
} from "@/utils/openai";

const getCurrentDirname = (metaUrl: string) => {
  const __filename = fileURLToPath(metaUrl);
  return dirname(__filename);
};

async function executeScript(
  scriptPath: string,
  csvFilePath: string,
  dependent_var: string,
  independent_var: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      `python ${scriptPath} ${csvFilePath} ${dependent_var} ${independent_var}`,
      (error, stdout, stderr) => {
        if (error) {
          console.error("Error: ", stderr);
          reject(error);
        }
        resolve(stdout.trim());
      }
    );
  });
}

async function getMostRelevantArticleChunk(
  question: string,
  url: string
): Promise<string[]> {
  console.log("Trying to get the most relevant article chunk");
  let data = JSON.stringify({
    question: question,
    temperature: 0.5,
  });

  let config = {
    method: "post",
    maxBodyLength: Infinity,
    url: url,
    headers: {
      "Content-Type": "application/json",
    },
    data: data,
  };

  try {
    const response = await axios.request(config);
    const context = JSON.parse(JSON.stringify(response.data.context));
    return context;
  } catch (error) {
    console.log(error);
    return [""];
  }
}

export const chatRouter = createRouter()
  .middleware(async ({ ctx, next }) => {
    if (!ctx.session) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next();
  })
  .mutation("create", {
    input: z.object({
      userId: z.string(),
    }),
    resolve: async ({ ctx: { prisma }, input }) => {
      // Create a new chat entry
      const chat = await prisma.chat.create({
        data: {
          userId: input.userId,
          title: "New Chat",
          content: "",
        },
        select: {
          id: true,
          title: true,
          content: true,
        },
      });
      return chat.id;
    },
  })
  .mutation("analysis", {
    input: z.object({
      data: z.string(),
    }),
    resolve: async ({ ctx: { prisma }, input }) => {
      const { message, conversationHistory } = JSON.parse(input.data);
      let indexLines = await readCSV();
      console.log(indexLines);

      if (JSON.stringify(indexLines) === "{}") {
        return { reply: "Please upload data files" };
      } else if (!JSON.stringify(conversationHistory).includes("Existing Datasets have indexes as below,")) {
        return {
          reply: "Existing Datasets have indexes as below, to proceed with linear regression analysis,\
         please tell me the independent variable name and dependent varible name\n" + JSON.stringify(indexLines)
        };
      }

      console.log(conversationHistory);
      // verify input csv integrity

      var independent_var;
      var dependent_var;
      // acquire independent variable
      var prompt =
        'Seek the independent variables and the dependent variable. If there is either, then return in JSON format where there is a key called "error" \
            if there are both, return in JSON format where independent_var, dependent_var are the keys. If there are multiple independent variables, then the values will be an array.\
             Allow fuzzy spelling';
      prompt +=
        "\nThe chat history is:\n" + JSON.stringify(conversationHistory);

      const reply = await chatCallJsonMode(prompt + message, "");
      let reply_json = JSON.parse(reply);
      if ("error" in reply_json) {
        console.log(reply);
        return { reply: reply_json["error"] };
      }

      // verify the name of the independent variable
      if (reply_json["independent_var"] == undefined) {
        console.log("Please specify the name of the independent variable");
        return {
          reply: "Please specify the name of the independent variable",
        };
      }

      // acquire dependent variable
      if (reply_json["dependent_var"] == undefined) {
        console.log("Please specify the name of the independent variable");
        return { reply: "Please specify the name of the dependent variable" };
      }
      console.log(reply_json);

      // verify the names acquired from chat against indexes in CSV
      console.log("verify the names acquired from chat against indexes in CSV");
      const csvFileNames = Object.keys(indexLines);
      console.log(csvFileNames);

      var prompt =
        'Find the closest match between 1. the given dependent_var and independent_var and 2. the given list of indexes\
          if no close match is found, then return in JSON format with key "error" \
          if matches for both dependent_var and independent_var are found, return in JSON format with dependent_var and independent_var as keys and their values as values\
          if the values of independent_var is an array, keep the array as the JSON value';
      prompt +=
        "\nThe given dependent_var and independent_var are:\n" +
        JSON.stringify(reply_json) +
        "\nThe given list of indexes are" +
        JSON.stringify(indexLines);

      const verifyIndexReply = await chatCallJsonMode(prompt, "");
      let verifyIndexJson = JSON.parse(verifyIndexReply);
      independent_var = verifyIndexJson["independent_var"];
      dependent_var = verifyIndexJson["dependent_var"];
      if ("error" in verifyIndexJson) {
        console.log(reply);
        return { reply: reply_json["error"] };
      }

      // Proceed to run analysis
      // Use the function to get the current directory
      const __dirname = getCurrentDirname(import.meta.url);
      console.log(__dirname);

      // Construct the path to your Python script
      let scriptPath;
      let formattedIndependentVar;

      if (Array.isArray(independent_var)) {
        scriptPath = join(__dirname, "..", "..", "..", "script/ols_mul.py");
        formattedIndependentVar = independent_var.join(',');
      } else {
        scriptPath = join(__dirname, "..", "..", "..", "script/ols.py");
        formattedIndependentVar = independent_var;
      }

      const csvPath = join(
        __dirname,
        "..",
        "..",
        "..",
        "storage",
        "user",
        "housing.csv"
      );

      const analysisResult = await executeScript(
        scriptPath,
        csvPath,
        formattedIndependentVar,
        dependent_var
      );
      console.log(analysisResult);

      var prompt =
        "Please explain the analysis results for this regression analysis, especially the relationship between the dependent_var and independent_var \
            using R-squared, adjusted R-squared, Coefficients, standard error, Diagnostic Tests. \
            Focus on coefficients.\
            Relate your answer to past academic papers by inferring from given index names. Be accurate, professional. I don't have fingers.";
      prompt += analysisResult + "";
      "\nThe given dependent_var and independent_var are:\n" +
        independent_var +
        " " +
        dependent_var +
        "\nThe given list of indexes are" +
        JSON.stringify(indexLines) +
        "\n\nAn example is For every additional 9.3 m2  of living space above the sample mean of 250.84 m2, an Auburn homeowner’s electricity usage increases an estimated 1.3 kWh/day (2.2%). These \
            findings indicate newer homes use significantly less energy than older homes. On average, a one-year-old home uses approximately 1.1 kWh/day (1.8%) less electricity, ceteris paribus, than an otherwise identical home that is 10 years older \
            ";

      const analysisReply = await chatCall(prompt);
      console.log(analysisReply);
      return { table: analysisResult, reply: analysisReply };
    },
  })
  .mutation("qna", {
    input: z.object({
      data: z.string(),
    }),
    resolve: async ({ ctx: { prisma }, input }) => {
      const { message, conversationHistory } = JSON.parse(input.data);
      const context = await getMostRelevantArticleChunk(message, process.env.EMBEDDING_SERVER_URL + "/search");
      context.push(conversationHistory);
      console.log("context", context);
      const response = await chatCallWithContext(
        message,
        JSON.stringify(context)
      );
      return { reply: response };
    },
  })
  .mutation("report", {
    input: z.object({
      data: z.string(),
    }),
    resolve: async ({ ctx: { prisma }, input }) => {
      const { message, conversationHistory } = JSON.parse(input.data);
      const context = await getMostRelevantArticleChunk(message, process.env.REPORT_SERVER_URL + "/search");
      context.push(conversationHistory);
      console.log("context", context);
      const prompt = "Genenerate a report for potential policy makers, mimic formats used in urban planning policy documents\
      Use academic and accurate langauge, include evidences included in the context\
      Perfect your answer of each section of the policy document you write. Send me multipart answers in the following messages\n\n";
      const response = await chatCallWithContext(
        prompt + message,
        JSON.stringify(context)
      );
      return { reply: response };
    },
  });
