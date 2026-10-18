"""Import a Notion HTML database; files are parsed as data, never executed."""
import argparse
import hashlib
import json
import pathlib
import re
import unicodedata
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit, urlunsplit
from bs4 import BeautifulSoup

SITE = pathlib.Path(__file__).resolve().parents[1]

def load_library():
    return json.loads((SITE / 'recipes.js').read_text(encoding='utf-8').removeprefix('window.RECIPES = ').rstrip(';\n'))

def canonical(url):
    p = urlsplit(url)
    host = p.netloc.lower().removeprefix('www.').replace('vk.com', 'vk.ru')
    query = [(k,v) for k,v in parse_qsl(p.query) if not k.startswith('utm_') and k not in ['c','telegram','context_id','integration']]
    return urlunsplit(('https',host,p.path.rstrip('/'),urlencode(query),''))

def text(node):
    return unicodedata.normalize('NFC',node.get_text(' ',strip=True))

def merge(library, imports):
    lookup = {r['id']:r for r in library}
    for item in imports:
        if item['id'] in lookup:
            existing=lookup[item['id']]
            for key in ['ingredients','steps','stepGroups']:
                if item.get(key): existing[key]=item[key]
            for key in ['tags','categories','aliases']:
                existing[key]=list(dict.fromkeys(existing.get(key,[])+item.get(key,[])))
            existing['notionOriginal']=item['original']
            existing['notionId']=item['notionId']
            existing['sources']=list(dict.fromkeys(existing.get('sources',[existing['source']])+item.get('sources',[])))
        else:
            library.append(item.copy());lookup[item['id']]=library[-1]
    return library

def extract(index, library):
    soup=BeautifulSoup(index.read_text(encoding='utf-8'),'html.parser')
    sources={canonical(s):r for r in library for s in r.get('sources',([r['source']] if r.get('source') else []))}
    imports=[];report={'added':[],'merged':[],'drafts':[],'skipped':[]}
    for row in soup.select('table.collection-content tbody tr') or soup.select('tbody tr'):
        cells=row.find_all('td',recursive=False)
        if len(cells)<5:continue
        link=cells[0].find('a')
        if not link:continue
        page=(index.parent/unquote(link['href'])).resolve()
        if not page.is_relative_to(index.parent.resolve()):raise ValueError('Export links outside its own folder')
        child=BeautifulSoup(page.read_text(encoding='utf-8'),'html.parser')
        title_node=child.select_one('.page-title');title=text(title_node) if title_node else ''
        title=re.sub(r'^[^\wА-Яа-яЁё]+','',title).strip()
        if not title or title=='Untitled':report['skipped'].append(page.name);continue
        body=child.select_one('.page-body')
        types=[text(n) for n in cells[1].select('.selected-value')]
        speed=[text(n) for n in cells[2].select('.selected-value')]
        features=[text(n) for n in cells[3].select('.selected-value')]
        urls=[]
        for a in cells[4].select('a[href]'):
            urls.extend(re.findall(r'https?://[^\s<>]+',a['href']))
        urls=list(dict.fromkeys(urls))
        tags=speed+features
        group='';ingredients=[];steps=[];groups=[];current=None;raw=[]
        for node in body.children:
            if not getattr(node,'name',None):continue
            line=text(node)
            if not line:continue
            if node.name in ['h1','h2','h3','h4']:
                group=line;current=None;raw.append(line);continue
            if node.name=='ul' and 'to-do-list' in node.get('class',[]):
                for todo in node.select('[class*=to-do-children]'):
                    value=text(todo)
                    if value:ingredients.append(value);raw.append(value)
            elif node.name=='ol':
                for li in node.find_all('li',recursive=False):
                    value=text(li)
                    if value:
                        if current is None:current={'title':group or 'Приготовление','steps':[]};groups.append(current)
                        steps.append(value);current['steps'].append(value);raw.append(value)
            else:raw.append(line)
        complete=bool(ingredients or steps)
        if not complete:
            tags.append('Ссылка без рецепта' if urls else 'Черновик')
            report['drafts'].append(title)
        cats=[{'Напиток':'Напитки'}.get(c,c) for c in types]
        if not cats:cats=['Перекус']
        match=next((sources[canonical(u)] for u in urls if canonical(u) in sources),None)
        ident=match['id'] if match else 'n'+hashlib.sha1(row.get('id',page.stem).encode()).hexdigest()[:10]
        if not match and any(r['title'].casefold()==title.casefold() for r in library):
            title+=' — из моей книги'
        item={'id':ident,'title':title,'source':urls[0] if urls else None,'sources':urls,'categories':cats,'tags':list(dict.fromkeys(tags)),'photo':None,'ingredients':ingredients,'steps':steps,'stepGroups':groups,'original':'\n\n'.join(raw) if complete else '', 'originalLabel':'Запись из моей книги','notionId':row.get('id'),'aliases':[title],'contentStatus':'recipe' if complete else 'bookmark' if urls else 'draft'}
        imports.append(item)
        report['merged' if match else 'added'].append(title)
    return imports,report

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('index',type=pathlib.Path);args=parser.parse_args()
    library=load_library();items,report=extract(args.index,library)
    (SITE/'tools'/'notion-library.json').write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    library=merge(library,items)
    (SITE/'recipes.js').write_text('window.RECIPES = '+json.dumps(library,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2));print('Total:',len(library))
