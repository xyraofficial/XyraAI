import PackageManager from "../ide/PackageManager";

export default function PackageManagerExample() {
  return (
    <div className="h-[500px] w-80 border border-border rounded-md overflow-hidden">
      <PackageManager
        onInstall={async (packageName, isDev) => {
          console.log("Installing:", packageName, isDev ? "(dev)" : "");
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }}
        onUninstall={async (packageName) => {
          console.log("Uninstalling:", packageName);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }}
      />
    </div>
  );
}
