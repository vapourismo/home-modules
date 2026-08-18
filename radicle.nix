{ ... }:
{
  programs.radicle = {
    enable = true;
    settings = {
      node.alias = "ole";
      node.connect = [
        "z6MkeiacB2PjqgAc9Hyi1oGW5U43RRXVMBBgJ3586gYdXTtU@46.224.149.156:8776"
      ];
      preferredSeeds = [
        "z6MkeiacB2PjqgAc9Hyi1oGW5U43RRXVMBBgJ3586gYdXTtU@46.224.149.156:8776"
      ];
    };
  };
}
