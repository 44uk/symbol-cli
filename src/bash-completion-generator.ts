import * as Path from 'path'
import * as glob from 'glob'
import { promisify } from 'util'

import { description, subcommands } from './commands/default'
import { ProfileOptions } from './interfaces/profile.options'

const sourceStruct = {
    meta: {
        description
    },
    source: [
        {
            name: 'account',
            desc: 'Get account related information',
            options: [
                {
                    name: 'generate',
                    desc: 'Generate new accounts',
                    options: [
                        { key: 'hd', flag: undefined, desc: '(Optional) Create an HD wallet.' },
                        { key: 'url', flag: 'u', desc: '(Optional) When saving profile, provide a Symbol Node URL.' },
                    ]
                },
                {
                    name: 'info',
                    desc: 'Get account information',
                    options: [
                        { key: 'profile', flag: undefined, desc: '(Optional) Select between your profiles, by providing a profile name.' }
                    ]
                }
            ]
        }
    ]
}
type source = typeof sourceStruct

Promise.all(subcommands.map(command => {
    const pattern = `${__dirname}/commands/${command.name}/*.ts`
    return promisify(glob)(pattern)
        .then(paths => {
            const options = paths
                .map(path => ({
                    name: Path.basename(path, '.ts'),
                    klass: require(path).default,
                }))
                .map(({ name, klass }) => ({
                    name,
                    desc: klass.description,
                    options: klass.optionDefinitions
                }))
            return {
                name: command.name,
                desc: command.brief,
                options,
            }
        })
        .catch(_ => console.error(_))
}))
    .then(source => {
        const struct = {
            meta: {
                description
            },
            source
        }
        // @ts-ignore
        console.log(generateCompletionScriptForBash(struct))
    })

function options2command(options: any) {
    return options
        .map((option: any) => [
                option.key  ? `--${option.key}` : undefined,
                option.flag ? `-${option.flag}` : undefined,
            ]
                .filter(_ => _)
                .join(' ')
        )
            .join(' ')
}

function generateCompletionScriptForBash(struct: source) {
    const { meta, source } = struct
    let script = `### begin symbol-cli-completion.bash ###
#
# ${meta.description} completion script for bash
#
# Installation: cat symbol-cli-completion.bash >> ~/.bashrc
# Or, maybe: mv symbol-cli-completion.bash /etc/bash_completion.d/symbol-cli
#
__symbol-cli-completion() {
    local cmds cur prev words cword split
    _init_completion || return

    if [ -x "$(command -v jq)" ] && [ "$prev" = "--profile" ]; then
        cmds=$(cat ~/.symbolrc.json | jq -r 'keys | join(" ")')
        COMPREPLY=( $(compgen -W "$cmds" -- "$cur") )
        return
    fi
`

    let caseBlock = `
    case \${words[1]} in`
    source.forEach(subCmd => {
        caseBlock += `
        ${subCmd.name})
            case \${words[2]} in`
        subCmd.options.forEach(option => {
            caseBlock += `
                ${option.name})
                    cmds="${options2command(option.options)}"
                ;;`
        })
        caseBlock += `
                *)
                    cmds="${subCmd.options.map(o => o.name).join(' ')}"
                ;;
            esac
        ;;`
    })
    caseBlock += `
        *)
            cmds="${source.map(s => s.name).join(' ')}"
        ;;
    esac`
    script += `${caseBlock}`
    script += `
    COMPREPLY=( $(compgen -W "$cmds" -- "$cur") )
}

complete -o default -F __symbol-cli-completion symbol-cli
### end symbol-cli-completion.bash ###`
    return script
}
