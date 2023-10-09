/**
 * Refer to hexo-generator-searchdb
 * https://github.com/next-theme/hexo-generator-searchdb/blob/main/dist/search.js
 * Modified by hexo-theme-butterfly
 */

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
    words.forEach(word => {
      if (this.unescape) {
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
      while ((position = text.indexOf(word, startPosition)) > -1) {
        index.push({ position, word })
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
      result += val.substring(index, position)
      index = position + length
      result += `<mark class="search-keyword">${val.substr(position, length)}</mark>`
    }
    result += val.substring(index, slice.end)
    return result
  }

  getResultItems (keywords) {
    const resultItems = []
    this.datas.forEach(({ title, content, tags, url }) => {
 
      // var keyword_tag = new Object()
      var keyword_tag = keywords
      let l_keywords = keywords[0].toString().split('').length //- 获取搜索关键词的长度
      let tagSearch = 0
      if(keywords[0][0] === '#' && l_keywords > 1 && keywords[0][1] !== '#'){
        tagSearch = 1
        // keywords = keyword_tag
      }
      // The number of different keywords included in the article.
      let [indexOfTitle, keysOfTitle] = this.getIndexByWord(keywords, title)
      let [indexOfContent, keysOfContent] = this.getIndexByWord(keywords, content)
      // let [indexOfTags, keysOfTags] = this.getIndexByWord(keywords,tags)
      let includedCount = new Set([...keysOfTitle, ...keysOfContent]).size
////////////////////////////////////////////////////////////////////////////////////////
//---------------------定义了tags-------------------------------------------------------
      let tags0 = ''
      let space = 1
      //-以双分号；；分割一篇文章内的标签
      for(let i=0;i<tags.length;i++){
        if(/\S/.test(tags[i])){
          space = 0
          tags0 += tags[i]
        }else{
          if(space === 0){
            tags0 += '；；'
            space = 1
          }
        }
      }

      //增加Tags片断
      // let [indexOfTags, keysOfTags] = this.getIndexByWord(keywords,tags)
      let [indexOfTags0, keysOfTags0] = this.getIndexByWord(keywords,tags0)
//--------------------------------------------------------------------------------------
////////////////////////////////////////////////////////////////////////////////////////
      // Show search results
      let hitCount = 0
      if(tagSearch){
        hitCount =  indexOfTags0.length
      }else{
        hitCount = indexOfTitle.length + indexOfContent.length + indexOfTags0.length
      }
      // const hitCount = indexOfTitle.length + indexOfContent.length + indexOfTags0.length


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

      //----------------------给标题的关键字强调------------------------------
      if (slicesOfTitle.length !== 0) {
        resultItem += `<div class="local-search-hit-item"><a href="${url.href}"><span class="search-result-title">${this.highlightKeyword(title, slicesOfTitle[0])}</span></a>`
      } else {
        resultItem += `<div class="local-search-hit-item"><a href="${url.href}"><span class="search-result-title">${title}</span></a>`
      }
      // slicesOfContent.forEach(slice => {
      //   resultItem += `<p class="search-result">${this.highlightKeyword(content, slice)}...</p></a>`
      // })

      //----------------------给正文片断的关键字强调------------------------------
      if(slicesOfContent.length !== 0){
        slicesOfContent.forEach(slice => {
          resultItem += `<p class="search-result">${this.highlightKeyword(content, slice)}...<br>`
        })
      } else{
        resultItem += `<p class="search-result">${content.substring(0,Math.min(120,content.length))}...<br>`
      }

      //----------------------给tags的关键字强调------------------------------
      let slicesOfTags0 = []
      //将新生成的（带标签标志的）splitTags生成一个slice
      while(indexOfTags0.length !== 0){
        slicesOfTags0.push(this.mergeIntoSlice(0,tags0.length,indexOfTags0))
      }
      //将新的slice中的关键字强调
      if(slicesOfTags0.length !== 0){
        slicesOfTags0.forEach(slice => {
          resultItem += `${this.highlightKeyword(tags0, slice)}</p>`
        })
      } else{
        resultItem += `${tags0}</p>`
      }

      let index = resultItem.indexOf("...<br>")
      //以"...</br>"为界，把要展示的结果一分为二；
      let resultItem1 = resultItem.substring(0, index+7)
      let resultItem2 = resultItem.substring(index+7,resultItem.length)
      //下面只改resultItem2，给tags前面加上标签符号

      // // 去掉标签后面的分号；；，再在每个标签前面加一个图标
      let indexTermin = resultItem2.indexOf("</p>") //终止位置
      let resultItem21 = ""
      if(indexTermin){
        space = 1
        resultItem21 = resultItem21.concat(`<i class="fas fa-tag"><span style="font-family:times,kaiti,STKaiti">`)
        for(let i=0;i<indexTermin;i++){
          if(resultItem2[i] !== '；'){
            space = 0
            resultItem21 = resultItem21.concat(resultItem2[i])         
          }else{
            if(space === 0)
            resultItem21 += '</span></i>&nbsp &nbsp<i class="fas fa-tag"><span style="font-family:times,kaiti,STKaiti">'
            space = 1          
          }
        }
        resultItem21 += '</span></i>'
      }else{
        resultItem21 = resultItem2
      }

      resultItem = resultItem1 + resultItem21 + `</div>`

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
              content: element.querySelector('content') && element.querySelector('content').textContent,
              url: element.querySelector('url').textContent,
              tags: element.querySelector('tags') && element.querySelector('tags').textContent
            }))
          : JSON.parse(res)
        // Only match articles with non-empty titles
        this.datas = this.datas.filter(data => data.title).map(data => {
          data.title = data.title.trim()
          data.content = data.content ? data.content.trim().replace(/<[^>]+>/g, '') : ''
          data.url = decodeURIComponent(data.url).replace(/\/{2,}/g, '/')
          data.tags = data.tags ? data.tags.trim().replace(/<[^>]+>/g, '') : ''
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

    $loadingStatus.textContent = ''
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
