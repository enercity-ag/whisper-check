# WhisperCheck

_WhisperCheck_ is an cli based alternative for the ThunderClient. WhisperCheck imports environments and collections created with ThunderClient.

_WhisperCheck_ can convert request collections created whith ThunderClient.

# Disclaimer

_WhisperCheck_ is still in beta. We solely add features as we need them ourselves.

# Installation

Since the package isn't stored in the npm default registry you have to tell npm where to find it instead.

Create or add the following lines into `~/.npmrc` (or into the root path of the repo of your choice...)

```
@enercity-ag:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=insert valid github access token here
```

Now you can install _WhisperCheck_ like any other npm package

`npm install @enercity-ag/whisper-check`

You can set the registry on commandline as well

```
npm install --@enercity-ag:registry=https://npm.pkg.github.com/ @enercity-ag/whisper-check --save-dev
```

## special case - GitHub action

Don't forget to configure the access to the package if a github runner of **another** repository wants to access the package using `{{secrets.$GITHUB_TOKEN}}` to authenticate. In this case go to the [@enercity-ag/whisper-check](https://github.com/orgs/enercity-ag/packages/npm/package/whisper-check) package an open the [package settings](https://github.com/orgs/enercity-ag/packages/npm/whisper-check/settings). Look for the section _Manage Actions Access_ and add the repo as needed.

# Installing the package globally

```bash
sudo npm i -g
```

# Usage

```bash
npx @enercity-ag\whisper-check --help
npx @enercity-ag\whisper-check check --help
npx @enercity-ag\whisper-check convert --help
```

See the example collections and environments under `-/demo-data` for further reference.

# Basic Syntax

```
npx @enercity-ag\whisper-check command [options] <command specific arguments>
```
