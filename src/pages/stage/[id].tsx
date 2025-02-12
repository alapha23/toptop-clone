import React, { useState, useEffect } from "react";
import { prisma } from "@/server/db/client";
import { useRouter } from "next/router";
import styles from "@/styles/project.[id].module.css";

import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
  NextPage,
} from "next";
import { unstable_getServerSession as getServerSession } from "next-auth";

import { authOptions } from "../api/auth/[...nextauth]";
import Navbar from "@/components/Layout/Navbar";
import { trpc } from "@/utils/trpc";
import { Project, Stage } from "@prisma/client";

const stages = [
  "Set Goals",
  "Analyze Data",
  "Generate Plan",
  "Evaluate Plan",
  "Choose Plan",
  "Generate Report",
];

const StagePage: NextPage<StagePageProps> = ({
  userId,
  stageId,
  stage,
  project
}) => {
  const router = useRouter();
  const stageUpdateMutation = trpc.useMutation("stage.update");

  useEffect(() => {
  }, [stageId]);

  const handleBackClick = async () => {
    await stageUpdateMutation.mutateAsync({
      data: JSON.stringify({ id: stageId }),
    });
    router.push(`/project`);
  };

  const handleFinalizeClick = async () => {
    await stageUpdateMutation.mutateAsync({
      data: JSON.stringify({ id: stageId }),
    });

    const allStageIds = JSON.parse(project.allStageIds);
    const nextIndex = stage.pos + 1;
    if (nextIndex >= 5) {
      alert("This is the final stage.");
      router.push(`/project`);
    } else {
      const nextStageId = allStageIds[nextIndex];
      router.push(`/stage/${nextStageId}`);
    }
  };

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        <div className={styles.progressBar}>
          {JSON.parse(project.allStageIds).map((stageId, index) => (
            <div
              key={stageId}
              className={`${styles.stage} ${stage.pos === index + 1 ? styles.current : ""}`}
              onClick={() => {
                if (stage.status !== 0) {
                  router.push(`/stage/${stageId}`);
                }
              }}
            >
              <button className={styles.dotButton}></button>
              {stage.pos === index + 1 && (
                <div className={styles.stageName}>{stages[index]}</div>
              )}
            </div>
          ))}
        </div>
        <div className={styles.content}>{/* Stage content goes here */}</div>
        <div>
          <button
            className={`${styles.finishButton} ${styles.button}`}
            onClick={handleBackClick}
          >
            Save and Return
          </button>
          <button className={styles.finishButton} onClick={handleFinalizeClick}>
            Next
          </button>
        </div>
      </div>
    </>
  );
};

export default StagePage;

type StagePageProps = InferGetServerSidePropsType<
  typeof getServerSideProps
>;

export const getServerSideProps = async ({
  req,
  res,
  query,
}: GetServerSidePropsContext) => {
  const session = await getServerSession(req, res, authOptions);


  if (!session?.user?.email) {
    return {
      redirect: {
        destination: "/sign-in",
        permanent: true,
      },
      props: {},
    };
  }

  const projectId = query.id;
  const stage = await prisma.stage.findUnique({ where: { id: projectId as string } });
  if (!stage) {
    return {
      notFound: true,
    };
  }
  const project = await prisma.project.findUnique({ where: { id: stage.projectId } });

  if (!project) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      userId: session.user.id,
      stageId: projectId,
      stage,
      project,
    },
  };
};
