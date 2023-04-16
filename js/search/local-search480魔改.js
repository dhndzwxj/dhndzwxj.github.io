/**
 * Refer to hexo-generator-searchdb
 * https://github.com/next-theme/hexo-generator-searchdb/blob/main/dist/search.js
 * Modified by hexo-theme-butterfly
 */

  // 定义一个深拷贝函数  接收目标target参数
function deepClone(target) {
  // 定义一个变量
  let result;
  // 如果当前需要深拷贝的是一个对象的话
  if (typeof target === 'object') {
    // 如果是一个数组的话
    if (Array.isArray(target)) {
      result = []; // 将result赋值为一个数组，并且执行遍历
      for (let i in target) {
        // 递归克隆数组中的每一项
        result.push(deepClone(target[i]))
      }
      // 判断如果当前的值是null的话；直接赋值为null
      } else if (target === null) {
        result = null;
        // 判断如果当前的值是一个RegExp对象的话，直接赋值 
      } else if (target.constructor === RegExp) {
        result = target;
      } else {
        // 否则是普通对象，直接for in循环，递归赋值对象的所有值
        result = {};
        for (let i in target) {
          result[i] = deepClone(target[i]);
        }
      }
  } else {
    // 如果不是对象的话，就是基本数据类型，那么直接赋值
    result = target;
  }
  // 返回最终结果
  return result;
}
  
class LocalSearch {
  constructor ({
    path = '',
    unescape = false,
    top_n_per_article = 1
  }) {
    this.path = path
    this.unescape = unescape
    this.top_n_per_article = top_n_per_article
    this.isfetched = false
    this.datas = null
  }

  getIndexByWord (words, text, caseSensitive = false) {
    const index = []
    const included = new Set()

    if (!caseSensitive) {
      text = text.toLowerCase()
    }
    words.forEach(word => { //关键词搜索的开始
      if (this.unescape) { //unescape默认为false，因此这段代码基本不起作用
        const div = document.createElement('div')
        div.innerText = word
        word = div.innerHTML
      }
      const wordLen = word.length
      if (wordLen === 0) return
      let startPosition = 0
      let position = -1
      if (!caseSensitive) {
        word = word.toLowerCase()
      }
      while ((position = text.indexOf(word, startPosition)) > -1) { //判断是否能在text中找到word，从第startPosition个元素开始搜索
        index.push({ position, word }) // 用push函数为数组index添加元素
        included.add(word)
        startPosition = position + wordLen
      }
    })
    // Sort index by position of keyword
    index.sort((left, right) => {
      if (left.position !== right.position) {
        return left.position - right.position
      }
      return right.word.length - left.word.length
    })
    return [index, included]
  }

  // Merge hits into slices
  mergeIntoSlice (start, end, index) {
    let item = index[0]
    let { position, word } = item
    const hits = []
    const count = new Set()
    while (position + word.length <= end && index.length !== 0) {
      count.add(word)
      hits.push({
        position,
        length: word.length
      })
      const wordEnd = position + word.length

      // Move to next position of hit
      index.shift()
      while (index.length !== 0) {
        item = index[0]
        position = item.position
        word = item.word
        if (wordEnd > position) {
          index.shift()
        } else {
          break
        }
      }
    }
    return {
      hits,
      start,
      end,
      count: count.size
    }
  }

  // Highlight title and content
  highlightKeyword (val, slice) {
    let result = ''
    let index = slice.start
    for (const { position, length } of slice.hits) {
      result += val.substring(index, position) //确定关键字之前的val文段
      index = position + length //index起始位置移动
      result += `<mark class="search-keyword">${val.substr(position, length)}</mark>`
    }
    result += val.substring(index, slice.end)
    return result
  }

  getResultItems (keywords) {
    const resultItems = []
    this.datas.forEach(({ title, content, url, tags }) => {
      // The number of different keywords included in the article.
      let [indexOfTitle, keysOfTitle] = this.getIndexByWord(keywords, title)
      let [indexOfContent, keysOfContent] = this.getIndexByWord(keywords, content)
      let [indexOfTags, keysOfTags] = this.getIndexByWord(keywords, tags)
      const includedCount = new Set([...keysOfTitle, ...keysOfContent, ...keysOfTags]).size

      // Show search results
      // let hitCount = 0
      let l_keywords = keywords[0].split('').length //- 获取搜索关键词的长度
      let keywords0 = deepClone(keywords) //- Object赋值会影响原对象，故采用这种方法赋值
      if(keywords0[0][0]=== '#' & keywords0[0].length>1){
        keywords0[0] = keywords0[0].substring(1) // 如果第一个字符为#且长度大于1，将关键词第一个#去掉后再匹配
      }

      if( keywords[0][0] === '#' && l_keywords > 1 && keywords[0][1] !== '#'){ //根据tags进行搜索的触发条件
        [indexOfTitle, keysOfTitle] = this.getIndexByWord(keywords0, title)
        [indexOfContent, keysOfContent] = this.getIndexByWord(keywords0, content)
        [indexOfTags, keysOfTags] = this.getIndexByWord(keywords0, tags)
        // hitCount = indexOfTitle.length + indexOfContent.length + indexOfTags.length //-indexOfTags.length
        // if (hitCount === 0) return     
      }
      // else{
      //   hitCount = indexOfTitle.length + indexOfContent.length + indexOfTags.length
      //   if (hitCount === 0) return
      // }
      const hitCount = indexOfTitle.length + indexOfContent.length + indexOfTags.length
      if (hitCount === 0) return

      const slicesOfTitle = []
      if (indexOfTitle.length !== 0) {
        slicesOfTitle.push(this.mergeIntoSlice(0, title.length, indexOfTitle))
      }

      let slicesOfContent = []
      while (indexOfContent.length !== 0) {
        const item = indexOfContent[0]
        const { position } = item
        // Cut out 120 characters. The maxlength of .search-input is 80.
        const start = Math.max(0, position - 20)
        const end = Math.min(content.length, position + 100)
        slicesOfContent.push(this.mergeIntoSlice(start, end, indexOfContent))
      }

      // Sort slices in content by included keywords' count and hits' count
      slicesOfContent.sort((left, right) => {
        if (left.count !== right.count) {
          return right.count - left.count
        } else if (left.hits.length !== right.hits.length) {
          return right.hits.length - left.hits.length
        }
        return left.start - right.start
      })

      // Select top N slices in content
      const upperBound = parseInt(this.top_n_per_article, 10)
      if (upperBound >= 0) {
        slicesOfContent = slicesOfContent.slice(0, upperBound)
      }

      let resultItem = ''

      url = new URL(url, location.origin)
      url.searchParams.append('highlight', keywords.join(' '))

      if (slicesOfTitle.length !== 0) {
        resultItem += `<div class="local-search-hit-item"><a href="${url.href}" target="_blank"><span class="search-result-title">${this.highlightKeyword(title, slicesOfTitle[0])}</span>` //# tags
      } else {
        resultItem += `<div class="local-search-hit-item"><a href="${url.href}" target="_blank"><span class="search-result-title">${title}</span>`
      }


      //----------- 自定义:搜索框内显示文章的tags -------------------
      let dataTags = tags
      let splitT = '' 
      //- 第一步：下面是去掉dataTags里非汉字和字母（数字）的部分，然后用两个汉字分号'；；'把各个tags分隔开（保存在spliT变量里）
      let space = 1
      for (let i=0;i<dataTags.length;i++){
        if (/\S/.test(dataTags[i])){ 
          // \S 匹配Unicode非空白
          space = 0
          splitT = splitT.concat(dataTags[i])
        }else{
          if(space===0){
            splitT = splitT + '；；' 
            space = 1
          } 
        }        
      }
      //去掉splitT末尾的双分号；；，将字母变为小写
      for(let i=0;i<splitT.length;i++){
        let l = splitT.length
        if(splitT[l-1]=='；' && l>1){
          splitT = splitT.substring(0,l-2)
        }
        splitT = splitT.trim().toLowerCase()
      }    
      //- 第二步： highlight all keywords
      keywords.forEach(keyword => {
        if(keyword[0] === '#' & keyword.length>1){
          keyword = keyword.substring(1) // 如果第一个字符为#且长度大于1，将关键词第一个#去掉后再匹配
        }
        splitT = splitT.replaceAll(keyword,'<span class="search-keyword">' + keyword +'</span>')
      }) 
      //- 第三步：由于第一步产生的为纯文本且包括双分号，此步骤去掉分号且加上fas fa-tag、控制字体（保存在splitTags里）
      let splitTags = '<i class="fas fa-tag"><span style="font-family:times">'
      space = 1
      for(let i=0;i<splitT.length;i++){
        if(splitT[i] !== '；'){
          space = 0
          splitTags = splitTags.concat(splitT[i])
        }else{
          if(space===0){
            splitTags = splitTags + '</span></i>&nbsp &nbsp<i class="fas fa-tag"><span style="font-family:times">'
            space = 1
          }
        }         
      }


      splitTags = splitTags + '</span></i>'
      slicesOfContent.forEach(slice => { 
        resultItem +=  `<p class="search-result">${this.highlightKeyword(content, slice)}...<br/>${splitTags}</p></a>`//成功版本，tags是原始标签
        // resultItem +=  `<p class="search-result">${this.highlightKeyword(content, slice)}...<br/>${hitCount+keywords0+keywords+slicesOfContent+splitTags}</p></a>` //测试版本
        // resultItem +=  `<p class="search-result">${this.highlightKeyword(content, slice)}...<br/>${indexOfContent.length}</p></a>`  //测试版本
        // resultItem +=  `<p class="search-result">${this.highlightKeyword(content, slice)}...<br/>${typeof(slicesOfContent)}</p></a>`  //测试版本
        // resultItem +=  `<p class="search-result">${this.highlightKeyword(content, slice)}...<br/>${Object.keys(slicesOfContent[0])+Object.values(slicesOfContent[0])}</p></a>` //测试版本,获取Object的相关信息
        // resultItem +=  `<p class="search-result">${this.highlightKeyword(content, slice)}...</p></a>` //原始版本
      })

      resultItem += '</div>'
      resultItems.push({
        item: resultItem,
        id: resultItems.length,
        hitCount,
        includedCount
      })
    })
    return resultItems
  }

  fetchData () {
    const isXml = !this.path.endsWith('json')
    fetch(this.path)
      .then(response => response.text())
      .then(res => {
        // Get the contents from search data
        this.isfetched = true
        this.datas = isXml
          ? [...new DOMParser().parseFromString(res, 'text/xml').querySelectorAll('entry')].map(element => ({
              title: element.querySelector('title').textContent,
              content: element.querySelector('content').textContent,
              url: element.querySelector('url').textContent,
              tags: element.querySelector('tags') && element.querySelector('tags').textContent
            }))
          : JSON.parse(res)
        // Only match articles with non-empty titles
        this.datas = this.datas.filter(data => data.title).map(data => {
          data.title = data.title.trim()
          data.content = data.content ? data.content.trim().replace(/<[^>]+>/g, '') : ''
          data.url = decodeURIComponent(data.url).replace(/\/{2,}/g, '/')
          data.tags = data.tags ? data.tags : ''
          return data
        })
        // Remove loading animation
        window.dispatchEvent(new Event('search:loaded'))
      })
  }

  // Highlight by wrapping node in mark elements with the given class name
  highlightText (node, slice, className) {
    const val = node.nodeValue
    let index = slice.start
    const children = []
    for (const { position, length } of slice.hits) {
      const text = document.createTextNode(val.substring(index, position))
      index = position + length
      const mark = document.createElement('mark')
      mark.className = className
      mark.appendChild(document.createTextNode(val.substr(position, length)))
      children.push(text, mark)
    }
    node.nodeValue = val.substring(index, slice.end)
    children.forEach(element => {
      node.parentNode.insertBefore(element, node)
    })
  }

  // Highlight the search words provided in the url in the text
  highlightSearchWords (body) {
    const params = new URL(location.href).searchParams.get('highlight')
    const keywords = params ? params.split(' ') : []
    if (!keywords.length || !body) return
    const walk = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null)
    const allNodes = []
    while (walk.nextNode()) {
      if (!walk.currentNode.parentNode.matches('button, select, textarea, .mermaid')) allNodes.push(walk.currentNode)
    }
    allNodes.forEach(node => {
      const [indexOfNode] = this.getIndexByWord(keywords, node.nodeValue)
      if (!indexOfNode.length) return
      const slice = this.mergeIntoSlice(0, node.nodeValue.length, indexOfNode)
      this.highlightText(node, slice, 'search-keyword')
    })
  }
}

window.addEventListener('load', () => {
// Search
  const { path, top_n_per_article, unescape, languages } = GLOBAL_CONFIG.localSearch
  const localSearch = new LocalSearch({
    path,
    top_n_per_article,
    unescape
  })

  const input = document.querySelector('#local-search-input input')
  const statsItem = document.getElementById('local-search-stats-wrap')
  const $loadingStatus = document.getElementById('loading-status')

  const inputEventFunction = () => {
    if (!localSearch.isfetched) return
    const searchText = input.value.trim().toLowerCase()
    if (searchText !== '') $loadingStatus.innerHTML = '<i class="fas fa-spinner fa-pulse"></i>'
    const keywords = searchText.split(/[-\s]+/)
    const container = document.getElementById('local-search-results')
    let resultItems = []
    if (searchText.length > 0) {
    // Perform local searching
      resultItems = localSearch.getResultItems(keywords)
    }
    if (keywords.length === 1 && keywords[0] === '') {
      container.classList.add('no-result')
      container.textContent = ''
    } else if (resultItems.length === 0) {
      container.textContent = ''
      statsItem.innerHTML = `<div class="search-result-stats">${languages.hits_empty.replace(/\$\{query}/, searchText)}</div>`
    } else {
      resultItems.sort((left, right) => {
        if (left.includedCount !== right.includedCount) {
          return right.includedCount - left.includedCount
        } else if (left.hitCount !== right.hitCount) {
          return right.hitCount - left.hitCount
        }
        return right.id - left.id
      })

      const stats = languages.hits_stats.replace(/\$\{hits}/, resultItems.length)

      container.classList.remove('no-result')
      container.innerHTML = `<div class="search-result-list">${resultItems.map(result => result.item).join('')}</div>`
      statsItem.innerHTML = `<hr><div class="search-result-stats">${stats}</div>`
      window.pjax && window.pjax.refresh(container)
    }

    $loadingStatus.innerHTML = ''
  }

  let loadFlag = false
  const $searchMask = document.getElementById('search-mask')
  const $searchDialog = document.querySelector('#local-search .search-dialog')

  // fix safari
  const fixSafariHeight = () => {
    if (window.innerWidth < 768) {
      $searchDialog.style.setProperty('--search-height', window.innerHeight + 'px')
    }
  }

  const openSearch = () => {
    const bodyStyle = document.body.style
    bodyStyle.width = '100%'
    bodyStyle.overflow = 'hidden'
    btf.animateIn($searchMask, 'to_show 0.5s')
    btf.animateIn($searchDialog, 'titleScale 0.5s')
    setTimeout(() => { input.focus() }, 300)
    if (!loadFlag) {
      !localSearch.isfetched && localSearch.fetchData()
      input.addEventListener('input', inputEventFunction)
      loadFlag = true
    }
    // shortcut: ESC
    document.addEventListener('keydown', function f (event) {
      if (event.code === 'Escape') {
        closeSearch()
        document.removeEventListener('keydown', f)
      }
    })

    fixSafariHeight()
    window.addEventListener('resize', fixSafariHeight)
  }

  const closeSearch = () => {
    const bodyStyle = document.body.style
    bodyStyle.width = ''
    bodyStyle.overflow = ''
    btf.animateOut($searchDialog, 'search_close .5s')
    btf.animateOut($searchMask, 'to_hide 0.5s')
    window.removeEventListener('resize', fixSafariHeight)
  }

  const searchClickFn = () => {
    document.querySelector('#search-button > .search').addEventListener('click', openSearch)
  }

  const searchFnOnce = () => {
    document.querySelector('#local-search .search-close-button').addEventListener('click', closeSearch)
    $searchMask.addEventListener('click', closeSearch)
    if (GLOBAL_CONFIG.localSearch.preload) {
      localSearch.fetchData()
    }
    localSearch.highlightSearchWords(document.getElementById('article-container'))
  }

  window.addEventListener('search:loaded', () => {
    const $loadDataItem = document.getElementById('loading-database')
    $loadDataItem.nextElementSibling.style.display = 'block'
    $loadDataItem.remove()
  })

  searchClickFn()
  searchFnOnce()

  // pjax
  window.addEventListener('pjax:complete', () => {
    !btf.isHidden($searchMask) && closeSearch()
    localSearch.highlightSearchWords(document.getElementById('article-container'))
    searchClickFn()
  })
})
