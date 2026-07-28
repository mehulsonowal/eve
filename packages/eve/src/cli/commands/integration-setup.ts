import { interactiveAsker } from "#setup/ask.js";
import type { AddChannelsDeps } from "#setup/boxes/add-channels.js";
import type { DeployProjectDeps } from "#setup/boxes/deploy-project.js";
import { deployChannelSetup } from "#setup/channel-setup-deployment.js";
import {
  channelSetupEnvironment,
  describeChannelSetupEnvironment,
} from "#setup/channel-setup-environment.js";
import {
  channelSetupIntegration,
  createChannelSetupUi,
} from "#setup/channel-setup-integrations.js";
import { detectDeployment, projectResolutionFromDeployment } from "#setup/project-resolution.js";
import { createPrompter, type Prompter } from "#setup/prompter.js";
import { isEveProject, type ChannelKind } from "#setup/scaffold/index.js";
import { createDefaultSetupState, type SetupState } from "#setup/state.js";
import { getVercelAuthStatus } from "#setup/vercel-project.js";

import { NOT_AN_AGENT_MESSAGE } from "./preconditions.js";
import type { RegistryCommandLogger } from "./registry.js";

export interface IntegrationSetupDependencies {
  createPrompter?: () => Prompter;
  detectDeployment: typeof detectDeployment;
  getVercelAuthStatus: typeof getVercelAuthStatus;
  addChannelsDeps?: AddChannelsDeps;
  deployProjectDeps?: DeployProjectDeps;
}

const defaultIntegrationSetupDependencies: IntegrationSetupDependencies = {
  detectDeployment,
  getVercelAuthStatus,
};

/** Runs a built-in integration setup after its registry payload is installed. */
export async function runIntegrationSetupCommand(
  logger: RegistryCommandLogger,
  appRoot: string,
  kind: ChannelKind,
  dependencies: IntegrationSetupDependencies = defaultIntegrationSetupDependencies,
): Promise<void> {
  if (!(await isEveProject(appRoot))) {
    logger.error(NOT_AN_AGENT_MESSAGE);
    process.exitCode = 1;
    return;
  }

  try {
    const prompter = dependencies.createPrompter?.() ?? createPrompter();
    prompter.intro(`Set up ${channelSetupIntegration(kind).label}`);
    prompter.log.message("Checking Vercel setup...");
    const [deployment, authStatus] = await Promise.all([
      dependencies.detectDeployment(appRoot),
      dependencies.getVercelAuthStatus(appRoot),
    ]);
    const project = projectResolutionFromDeployment(deployment);
    const environment = channelSetupEnvironment(authStatus, project);
    prompter.log.info(describeChannelSetupEnvironment(environment));
    const state: SetupState = {
      ...createDefaultSetupState(),
      project,
      projectPath: { kind: "resolved", inPlace: true, path: appRoot },
      channelSelection: [kind],
    };
    const result = await channelSetupIntegration(kind).setup({
      environment,
      state,
      ui: createChannelSetupUi({ asker: interactiveAsker(prompter), prompter }),
      skipDependencyMutation: true,
      deps: dependencies.addChannelsDeps,
    });
    if (result.kind === "cancelled") return;
    let finalState = result.state;
    const addedVercelChannel =
      finalState.slackbotAttached ||
      (environment.vercel.kind === "available" && finalState.channels.includes("web"));
    if (addedVercelChannel) {
      finalState = await deployChannelSetup({
        state: finalState,
        ui: createChannelSetupUi({ asker: interactiveAsker(prompter), prompter }),
        presetDeploy: !process.stdin.isTTY || !process.stdout.isTTY ? false : undefined,
        deps: dependencies.deployProjectDeps,
      });
    }
    prompter.outro(finalState.channels.includes(kind) ? "Integration set up." : "No changes made.");
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
