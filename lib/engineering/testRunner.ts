import { exec } from "node:child_process";

export type CommandResult = {
  command: string;
  success: boolean;
  stdout: string;
  stderr: string;
};

export function runCommand(cmd: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    exec(cmd, { cwd: process.cwd(), timeout: 300000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          command: cmd,
          success: false,
          stdout: stdout || "",
          stderr: stderr || err.message,
        });
        return;
      }

      resolve({
        command: cmd,
        success: true,
        stdout: stdout || "",
        stderr: stderr || "",
      });
    });
  });
}
