// "https://unified-api-dc01.example.net:8443" -> "dc01": the
// part of the hostname that differs between instances. One spelling for
// every page that names an instance (Topology, a remote source's overview).
export function instanceName(url: string) {
  try {
    const host = new URL(url).hostname.split(".")[0];
    return host.replace(/^unified-api-?/, "") || host;
  } catch {
    return url;
  }
}
