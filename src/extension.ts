import * as vscode from 'vscode'

/**
 * 扩展激活函数
 */
export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'extension.htmlTagWrap',
    async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) return

      // 包裹标签
      await wrapWithTag(editor)
    },
  )

  context.subscriptions.push(disposable)
}

/**
 * 使用 Snippet 包裹选中的文本
 *
 * 优点：
 * 1. 代码简洁
 * 2. 自动支持 Tab 键导航
 * 3. 使用格式化命令处理缩进
 * 4. 支持多光标操作
 */
async function wrapWithTag(editor: vscode.TextEditor) {
  const isHtml = isHtmlLikeFile(editor)

  const config = vscode.workspace.getConfiguration('htmltagwrap')

  const tag = config.get<string>('tag') || 'div'
  const needModifyTag = config.get<boolean>('needModifyTag', false)
  const needAddAttribute = config.get<boolean>('needAddAttribute', false)
  const needFormatCode = config.get<boolean>('needFormatCode', false)
  const workWithMultiLineText = config.get<boolean>(
    'workWithMultiLineText',
    false,
  )

  const selections = editor.selections

  // 从后往前处理选区，避免位置变化导致的偏移
  for (let i = selections.length - 1; i >= 0; i--) {
    const selection = selections[i]
    const selectedText = editor.document.getText(selection).trim()
    const isMultiLine = selection.end.line !== selection.start.line

    if (
      isMultiLine &&
      // (isHtml ||
      //   (!needFormatCode &&
      //     !(workWithMultiLineText && (needModifyTag || needAddAttribute))))
      !needFormatCode &&
      !(workWithMultiLineText && (needModifyTag || needAddAttribute))
    ) {
      // 使用Emmet的wrapWithAbbreviation命令，并传入预设的标签
      await vscode.commands.executeCommand(
        'editor.emmet.action.wrapWithAbbreviation',
        {
          abbreviation: tag,
        },
      )
      return
    }

    // 创建 Snippet
    const snippet = new vscode.SnippetString()

    snippet.appendText('<')
    if (needModifyTag) {
      // 使用 placeholder 让标签名可选中
      snippet.appendPlaceholder(tag, 1)
    } else {
      snippet.appendText(tag)
    }

    if (needAddAttribute) {
      snippet.appendText(' ')
      // placeholder 用于添加属性
      snippet.appendPlaceholder('attribute=""', 2)
    }
    snippet.appendText('>')

    if (isMultiLine) {
      snippet.appendText('\n')
    }

    // 如果有内容，在内容后面添加 placeholder，让光标可以跳转到结束标签前
    if (selectedText) {
      snippet.appendText(selectedText)
      // 第二个 placeholder，在内容后面
      snippet.appendPlaceholder('', 0)
    } else {
      // 如果没有内容，直接在标签之间添加 placeholder
      snippet.appendPlaceholder('', 0)
    }

    if (isMultiLine) {
      snippet.appendText('\n')
    }

    snippet.appendText('</')
    if (needModifyTag) {
      // 同样的 placeholder，结束标签会同步更新
      snippet.appendPlaceholder(tag, 1)
    } else {
      snippet.appendText(tag)
    }
    snippet.appendText('>')

    // 插入 Snippet
    await editor.insertSnippet(snippet, selection)

    if (needFormatCode || (workWithMultiLineText && isMultiLine)) {
      if (isHtml) {
        // 格式化整个文档，自动处理缩进
        await vscode.commands.executeCommand('editor.action.formatDocument')
      } else {
        // 格式化选定内容，自动处理缩进
        await vscode.commands.executeCommand('editor.action.formatSelection')
      }
    }
  }
}

function isHtmlFile(editor: vscode.TextEditor): boolean {
  return editor.document.languageId === 'html'
}

function isHtmlFileByExtension(editor: vscode.TextEditor): boolean {
  const fileName = editor.document.fileName
  const htmlExtensions = ['.html', '.htm', '.xhtml']
  return htmlExtensions.some((ext) => fileName.toLowerCase().endsWith(ext))
}

/**
 * 判断当前文件是否为HTML相关文件
 */
function isHtmlLikeFile(editor: vscode.TextEditor): boolean {
  const languageId = editor.document.languageId
  // 支持HTML及相关的语言模式
  const htmlLikeLanguages = [
    'html',
    'vue',
    // 'xml',
    // 'xsl',
    // 'jsx',
    // 'tsx',
    // 'svelte',
  ]
  return htmlLikeLanguages.includes(languageId)
}
