import {Component,type ReactNode} from 'react';

export default class PageBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  componentDidCatch(error:Error){console.error('Portal page could not load.',error);}
  render(){
    return this.state.failed?<section role="alert" className="space-y-3 p-6 text-base text-[#123323]"><h1 className="font-bold">This page could not load.</h1><p>Reload the portal to try again when connected.</p><button type="button" className="min-h-11 rounded border border-[#c9d1ca] bg-white px-4 font-semibold" onClick={()=>window.location.reload()}>Reload portal</button></section>:this.props.children;
  }
}
